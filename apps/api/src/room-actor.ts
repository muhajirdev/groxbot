/** Cloudflare-only. Excluded from `tsc`. Place Durable Object — never runs the model. */
import { DurableObject } from "cloudflare:workers";
import {
  officeUserFromHeaders,
  stampIncomingOfficeUser,
} from "@groxbot/contracts";
import {
  mentionFromText,
  OFFICE_GENERATION_STORAGE,
  OFFICE_WORKSPACE_HEADER,
  type OfficeChatMessage,
  officeChatShouldRun,
  officeChatText,
  parseOfficeChatMessage,
  parseOfficeChatMessages,
  RoomError,
  resolveRoomTarget,
  roomWakeJob,
  sanitizeComputerPath,
} from "@groxbot/core";
import type { WorkerEnv } from "./bot-actor.js";
import { enqueueOnBot } from "./bot-enqueue.js";
import { type RoomChatSubscriber, roomRpcResponse } from "./room-rpc.js";

type RoomMemberRow = { id: string; name: string };

export class RoomActor extends DurableObject<WorkerEnv> {
  private subscribers = new Set<RoomChatSubscriber>();
  private status: "ready" | "submitted" | "streaming" | "error" = "ready";
  private error = "";
  private floorBotId = "";

  constructor(ctx: DurableObjectState, env: WorkerEnv) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS room_chat (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT NOT NULL UNIQUE,
          payload TEXT NOT NULL
        )
      `);
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS room_files (
          path TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") === "websocket") {
      const claimed = request.headers.get(OFFICE_WORKSPACE_HEADER);
      const workspaceId = await this.workspaceId();
      if (!workspaceId || claimed !== workspaceId) {
        return new Response("Forbidden", { status: 403 });
      }
      return roomRpcResponse(
        this,
        request,
        officeUserFromHeaders(request.headers),
      );
    }
    if (request.method === "POST" && url.pathname === "/init") {
      return this.handleInit(request);
    }
    if (request.method === "POST" && url.pathname === "/turns/stream") {
      return this.handleTurnStream(request);
    }
    if (request.method === "POST" && url.pathname === "/turns/complete") {
      return this.handleTurnComplete(request);
    }
    if (request.method === "POST" && url.pathname === "/turns/error") {
      return this.handleTurnError(request);
    }
    if (request.method === "POST" && url.pathname === "/turns/abort") {
      return this.handleTurnAbort(request);
    }
    if (request.method === "POST" && url.pathname === "/files/list") {
      return this.handleFilesList(request);
    }
    if (request.method === "POST" && url.pathname === "/files/read") {
      return this.handleFilesRead(request);
    }
    if (request.method === "POST" && url.pathname === "/files/write") {
      return this.handleFilesWrite(request);
    }
    return new Response("Not found", { status: 404 });
  }

  async subscribeRoom(subscriber: RoomChatSubscriber): Promise<void> {
    const live = subscriber.dup?.() ?? subscriber;
    this.subscribers.add(live);
    live.onRpcBroken?.(() => {
      this.subscribers.delete(live);
    });
    const generation =
      (await this.ctx.storage.get<number>(OFFICE_GENERATION_STORAGE)) ?? 0;
    await live.streamGeneration(generation);
    for (const row of this.readLog()) {
      await live.message(row);
    }
    if (this.error) await live.error(this.error);
    await live.status(this.status);
  }

  async runRoom(
    messages: OfficeChatMessage[],
    user: ReturnType<typeof officeUserFromHeaders>,
    opts: { targetBotId?: string },
  ): Promise<void> {
    const stamped = messages.map((row) => {
      if (row.role !== "user") return row;
      const existing = this.readLog().find((item) => item.id === row.id);
      return (
        parseOfficeChatMessage(stampIncomingOfficeUser(row, user, existing)) ??
        row
      );
    });
    this.writeLog(stamped);
    await this.broadcastLog(stamped);
    if (!officeChatShouldRun(stamped)) {
      this.status = "ready";
      await this.broadcastStatus();
      return;
    }
    const members = await this.members();
    const last = stamped.at(-1);
    const mention = last ? mentionFromText(officeChatText(last)) : null;
    let target: RoomMemberRow;
    try {
      target = resolveRoomTarget(members, {
        targetBotId: opts.targetBotId,
        mention,
      });
    } catch (error) {
      this.status = "error";
      this.error =
        error instanceof RoomError ? error.message : "Name who should answer.";
      await this.broadcastError();
      await this.broadcastStatus();
      return;
    }
    this.error = "";
    this.status = "submitted";
    this.floorBotId = target.id;
    await this.ctx.storage.put("floorBotId", target.id);
    await this.bumpGeneration();
    await this.broadcastStatus();
    const roomId = (await this.ctx.storage.get<string>("roomId")) || "";
    if (!roomId) {
      this.status = "error";
      this.error = "This room is not ready yet.";
      await this.broadcastError();
      await this.broadcastStatus();
      return;
    }
    const job = roomWakeJob({
      roomId,
      roomName: (await this.ctx.storage.get<string>("name")) || "Room",
      members,
      messages: stamped,
      targetBotId: target.id,
    });
    await enqueueOnBot(this.env.BOT_ACTOR, job);
  }

  async stopRoom(): Promise<void> {
    const floor =
      this.floorBotId ||
      (await this.ctx.storage.get<string>("floorBotId")) ||
      "";
    this.status = "ready";
    this.floorBotId = "";
    await this.ctx.storage.delete("floorBotId");
    await this.broadcastStatus();
    if (!floor) return;
    await enqueueOnBot(this.env.BOT_ACTOR, {
      botId: floor,
      name: "run.abort",
      payload: {},
    });
  }

  private async handleInit(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as {
      roomId?: unknown;
      workspaceId?: unknown;
      name?: unknown;
      members?: unknown;
    };
    const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!roomId || !workspaceId || !name) {
      return Response.json(
        { error: "Room is missing fields." },
        { status: 400 },
      );
    }
    const members = Array.isArray(body.members)
      ? body.members.flatMap((row) => {
          if (!row || typeof row !== "object" || Array.isArray(row)) return [];
          const item = row as { id?: unknown; name?: unknown };
          const id = typeof item.id === "string" ? item.id.trim() : "";
          const memberName =
            typeof item.name === "string" ? item.name.trim() : "";
          return id && memberName ? [{ id, name: memberName }] : [];
        })
      : [];
    await this.ctx.storage.put("roomId", roomId);
    await this.ctx.storage.put("workspaceId", workspaceId);
    await this.ctx.storage.put("name", name);
    await this.ctx.storage.put("members", members);
    return Response.json({ ok: true });
  }

  private async requireWorkspace(request: Request): Promise<boolean> {
    const claimed = request.headers.get(OFFICE_WORKSPACE_HEADER);
    const workspaceId = await this.workspaceId();
    return Boolean(workspaceId && claimed === workspaceId);
  }

  private async handleTurnStream(request: Request): Promise<Response> {
    if (!(await this.requireWorkspace(request))) {
      return new Response("Forbidden", { status: 403 });
    }
    const message = parseOfficeChatMessage(
      ((await request.json().catch(() => ({}))) as { message?: unknown })
        .message,
    );
    if (!message) return Response.json({ ok: true });
    this.status = "streaming";
    await this.broadcast((sub) => sub.stream({ message }));
    await this.broadcastStatus();
    return Response.json({ ok: true });
  }

  private async handleTurnComplete(request: Request): Promise<Response> {
    if (!(await this.requireWorkspace(request))) {
      return new Response("Forbidden", { status: 403 });
    }
    const message = parseOfficeChatMessage(
      ((await request.json().catch(() => ({}))) as { message?: unknown })
        .message,
    );
    if (message) {
      const next = [
        ...this.readLog().filter((row) => row.id !== message.id),
        message,
      ];
      this.writeLog(next);
      await this.broadcast((sub) => sub.message(message));
    }
    this.status = "ready";
    this.error = "";
    this.floorBotId = "";
    await this.ctx.storage.delete("floorBotId");
    await this.broadcastStatus();
    return Response.json({ ok: true });
  }

  private async handleTurnError(request: Request): Promise<Response> {
    if (!(await this.requireWorkspace(request))) {
      return new Response("Forbidden", { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as {
      message?: unknown;
    };
    this.status = "error";
    this.error =
      typeof body.message === "string" && body.message
        ? body.message
        : "The model run failed.";
    await this.broadcastError();
    await this.broadcastStatus();
    return Response.json({ ok: true });
  }

  private async handleTurnAbort(request: Request): Promise<Response> {
    if (!(await this.requireWorkspace(request))) {
      return new Response("Forbidden", { status: 403 });
    }
    this.status = "ready";
    this.floorBotId = "";
    await this.ctx.storage.delete("floorBotId");
    await this.broadcastStatus();
    return Response.json({ ok: true });
  }

  private async handleFilesList(request: Request): Promise<Response> {
    if (!(await this.requireWorkspace(request))) {
      return new Response("Forbidden", { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as { path?: unknown };
    let prefix = "";
    try {
      prefix = sanitizeComputerPath(
        typeof body.path === "string" ? body.path : "",
      );
    } catch {
      return Response.json(
        { error: "That path is not allowed." },
        { status: 400 },
      );
    }
    const rows = this.fileRows();
    const entries = rows
      .map((row) => row.path)
      .filter((path) =>
        prefix ? path === prefix || path.startsWith(`${prefix}/`) : true,
      );
    return Response.json({ entries });
  }

  private async handleFilesRead(request: Request): Promise<Response> {
    if (!(await this.requireWorkspace(request))) {
      return new Response("Forbidden", { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as { path?: unknown };
    let path = "";
    try {
      path = sanitizeComputerPath(
        typeof body.path === "string" ? body.path : "",
      );
    } catch {
      return Response.json(
        { error: "That path is not allowed." },
        { status: 400 },
      );
    }
    if (!path) {
      return Response.json(
        { error: "Pick a paper on this table." },
        { status: 400 },
      );
    }
    const row = this.fileRows().find((item) => item.path === path);
    if (!row) {
      return Response.json(
        { error: "No paper at that path." },
        { status: 404 },
      );
    }
    return Response.json({ path, content: row.content });
  }

  private async handleFilesWrite(request: Request): Promise<Response> {
    if (!(await this.requireWorkspace(request))) {
      return new Response("Forbidden", { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as {
      path?: unknown;
      content?: unknown;
    };
    let path = "";
    try {
      path = sanitizeComputerPath(
        typeof body.path === "string" ? body.path : "",
      );
    } catch {
      return Response.json(
        { error: "That path is not allowed." },
        { status: 400 },
      );
    }
    if (!path) {
      return Response.json(
        { error: "Name a paper on this table." },
        { status: 400 },
      );
    }
    const content = typeof body.content === "string" ? body.content : "";
    this.ctx.storage.sql.exec(
      `INSERT INTO room_files (path, content, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
      path,
      content,
      Date.now(),
    );
    return Response.json({ path, size: content.length });
  }

  private fileRows(): Array<{ path: string; content: string }> {
    const cursor = this.ctx.storage.sql.exec(
      `SELECT path, content FROM room_files ORDER BY path ASC`,
    );
    const rows: Array<{ path: string; content: string }> = [];
    for (const row of cursor) {
      const path = typeof row.path === "string" ? row.path : "";
      const content = typeof row.content === "string" ? row.content : "";
      if (path) rows.push({ path, content });
    }
    return rows;
  }

  private readLog(): OfficeChatMessage[] {
    const cursor = this.ctx.storage.sql.exec(
      `SELECT payload FROM room_chat ORDER BY seq ASC`,
    );
    const payloads: unknown[] = [];
    for (const row of cursor) {
      if (typeof row.payload !== "string") continue;
      try {
        payloads.push(JSON.parse(row.payload) as unknown);
      } catch {
        payloads.push(null);
      }
    }
    return parseOfficeChatMessages(payloads);
  }

  private writeLog(messages: OfficeChatMessage[]): void {
    this.ctx.storage.sql.exec(`DELETE FROM room_chat`);
    for (const row of messages) {
      this.ctx.storage.sql.exec(
        `INSERT INTO room_chat (id, payload) VALUES (?, ?)`,
        row.id,
        JSON.stringify(row),
      );
    }
  }

  private async bumpGeneration(): Promise<number> {
    const current =
      (await this.ctx.storage.get<number>(OFFICE_GENERATION_STORAGE)) ?? 0;
    const next = current > 0 ? current + 1 : 1;
    await this.ctx.storage.put(OFFICE_GENERATION_STORAGE, next);
    await this.broadcast((sub) => sub.streamGeneration(next));
    return next;
  }

  private async broadcast(
    fn: (subscriber: RoomChatSubscriber) => void | Promise<void>,
  ): Promise<void> {
    for (const subscriber of [...this.subscribers]) {
      try {
        await fn(subscriber);
      } catch {
        this.subscribers.delete(subscriber);
      }
    }
  }

  private broadcastLog(messages: OfficeChatMessage[]): Promise<void> {
    return this.broadcast(async (sub) => {
      for (const row of messages) await sub.message(row);
    });
  }

  private broadcastStatus(): Promise<void> {
    return this.broadcast((sub) => sub.status(this.status));
  }

  private broadcastError(): Promise<void> {
    return this.broadcast((sub) => sub.error(this.error));
  }

  private async workspaceId(): Promise<string> {
    const stored = await this.ctx.storage.get<string>("workspaceId");
    return typeof stored === "string" ? stored : "";
  }

  private async members(): Promise<RoomMemberRow[]> {
    const stored =
      (await this.ctx.storage.get<RoomMemberRow[]>("members")) ?? [];
    return Array.isArray(stored) ? stored : [];
  }
}
