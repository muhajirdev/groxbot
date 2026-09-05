/** Cloudflare-only. Excluded from `tsc`. One RoomActor class: that person’s own room, or a group. */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  gatewayConfigured,
  gatewayRequestModel,
  loadGatewayConfig,
  piCompletionsModel,
  resolvePiAiModel,
  resolvePiStreamFn,
  runPiTurn,
} from "@groxbot/adapters/edge";
import {
  HOSTED_STARTER_MODEL,
  labelForModel,
  officeUserFromHeaders,
  stampIncomingOfficeUser,
} from "@groxbot/contracts";
import {
  applyPiOfficeEvent,
  buildOfficeSystemPrompt,
  composePersonDoorSoul,
  emptyPiOfficeView,
  encryptionSecret,
  jsonClone,
  mentionFromText,
  officeCanReadSkills,
  OFFICE_GENERATION_STORAGE,
  OFFICE_WORKSPACE_HEADER,
  parsePiClientEvent,
  parsePiLogMessages,
  piGroupLoopMessages,
  type PiBoundMessage,
  type PiClientEvent,
  type PiOfficeSnapshot,
  type PiSendMessageInput,
  piLogShouldRun,
  PiSteerQueue,
  piQueuedUserBound,
  takePiAssistantDraft,
  piUserText,
  piViewMessages,
  RoomError,
  resolveRoomTargets,
  resolveRunModel,
  roomTurnSystem,
  sanitizeComputerPath,
  teammatePrompt,
  withRoomSpeaker,
} from "@groxbot/core";
import { bots } from "@groxbot/db";
import { createNeonHttpDb } from "@groxbot/db/neon";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { RoomHome, type WorkerEnv } from "./bot-actor.js";
import { officeAgentTool } from "./bot-office-tools.js";
import { agentRuntimeSource, productEnv } from "./env.js";
import {
  personDoorContext,
  personDoorTool,
  personDoorTools,
} from "./person-door.js";
import { roomFileOp, type RoomChatSubscriber, roomRpcResponse } from "./room-rpc.js";

type RoomMemberRow = { id: string; name: string; homeRoomId?: string };

export class RoomActor extends RoomHome {
  private subscribers = new Set<RoomChatSubscriber>();
  private status: "ready" | "submitted" | "streaming" | "error" = "ready";
  private error = "";
  private floorBotId = "";
  private roomSeq = 0;
  private guestTurn: AbortController | null = null;
  private roomSteer = new PiSteerQueue();

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

  async onStart(): Promise<void> {
    if (!(await this.isPersonRoom())) {
      const stored = await this.ctx.storage.get<string>("workspaceId");
      if (typeof stored === "string" && stored && !this.officeId) {
        this.officeId = stored;
      }
      const floor = await this.ctx.storage.get<string>("floorBotId");
      this.floorBotId = typeof floor === "string" ? floor.trim() : "";
      return;
    }
    await super.onStart();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/init") {
      return this.handleInit(request);
    }
    if (!(await this.isPersonRoom())) {
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
      if (request.method === "POST" && url.pathname === "/destroy") {
        return this.handleDestroy();
      }
      return new Response("Not found", { status: 404 });
    }
    return super.fetch(request);
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
    const snapshot = jsonClone(await this.snapshotRoom());
    if (snapshot) {
      await live.event({
        type: "snapshot",
        snapshot,
        threadId: this.name,
        seq: this.roomSeq,
      });
    }
    if (this.error) await live.error(this.error);
    await live.status(this.status);
  }

  async snapshotRoom(): Promise<PiOfficeSnapshot> {
    const status =
      this.status === "error"
        ? "failed"
        : this.status === "ready"
          ? "idle"
          : "running";
    const snapshot: PiOfficeSnapshot = {
      metadata: { id: this.name, status },
      messages: [
        ...this.readLog(),
        ...this.roomSteer.pending().map(piQueuedUserBound),
      ],
    };
    if (this.error) snapshot.lastError = this.error;
    if (this.floorBotId) snapshot.floorBotId = this.floorBotId;
    return snapshot;
  }

  async sendRoom(
    input: PiSendMessageInput,
    user: ReturnType<typeof officeUserFromHeaders>,
  ): Promise<void> {
    const id = input.id?.trim() || crypto.randomUUID();
    const log = this.readLog();
    const existing = log.find((row) => row.id === id);
    const stamped = stampIncomingOfficeUser(
      { role: "user", metadata: input.metadata },
      user,
      existing,
    );
    const row: PiBoundMessage = {
      id,
      metadata: stamped.metadata,
      message: {
        role: "user",
        content: input.content,
        timestamp: Date.now(),
      },
    };
    const running = Boolean(this.guestTurn && !this.guestTurn.signal.aborted);
    if (running) {
      this.roomSteer.push({
        id,
        content: input.content,
        metadata: stamped.metadata,
        timestamp: Date.now(),
      });
      await this.broadcastEvent({
        type: "message_end",
        id,
        message: row.message,
        metadata: row.metadata,
      });
      return;
    }
    const next = existing
      ? log.map((item) => (item.id === id ? row : item))
      : [...log, row];
    this.writeLog(next);
    await this.broadcastEvent({
      type: "message_end",
      id,
      message: row.message,
      metadata: row.metadata,
    });
    if (!piLogShouldRun(next)) {
      this.status = "ready";
      await this.broadcastStatus();
      return;
    }
    const members = await this.members();
    const mention = mentionFromText(
      piUserText(row.message),
      members.map((seat) => seat.name),
    );
    let targets: RoomMemberRow[];
    try {
      targets = resolveRoomTargets(members, {
        targetBotId: input.targetBotId,
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
    await this.setFloor(targets[0]?.id ?? "");
    await this.bumpGeneration();
    await this.broadcastStatus();
    const abort = new AbortController();
    this.guestTurn?.abort();
    this.guestTurn = abort;
    this.ctx.waitUntil(
      this.runGuestRound(targets, abort).catch((error) => {
        console.error("room guest turn", this.name, error);
      }),
    );
  }

  async stopRoom(): Promise<void> {
    this.guestTurn?.abort();
    this.guestTurn = null;
    const leftover = this.roomSteer.takeAll();
    if (leftover.length) {
      const log = this.readLog();
      this.writeLog([
        ...log,
        ...leftover
          .filter((row) => !log.some((item) => item.id === row.id))
          .map(piQueuedUserBound),
      ]);
    }
    this.status = "ready";
    await this.setFloor("");
    await this.broadcastStatus();
  }

  private async runGuestRound(
    targets: RoomMemberRow[],
    abort: AbortController,
  ): Promise<void> {
    try {
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        if (!target || abort.signal.aborted || this.guestTurn !== abort) return;
        await this.setFloor(target.id);
        const halted = await this.runGuestTurn(
          target,
          this.readLog(),
          abort,
          i === targets.length - 1,
          targets.length > 1,
        );
        if (halted) return;
      }
    } finally {
      if (this.guestTurn === abort) this.guestTurn = null;
    }
  }

  private async runGuestTurn(
    target: RoomMemberRow,
    messages: PiBoundMessage[],
    abort: AbortController,
    settle: boolean,
    around: boolean,
  ): Promise<boolean> {
    const workspaceId = await this.workspaceId();
    const ns = this.env.ROOM_ACTOR;
    const homeRoomId = target.homeRoomId || target.id;
    if (!ns || !workspaceId) {
      this.status = "error";
      this.error = "This room is not ready yet.";
      await this.broadcastError();
      await this.broadcastStatus();
      return true;
    }
    const brain = await this.loadGuestBrain(target.id, workspaceId);
    if (abort.signal.aborted) return true;
    if (!brain.streamFn) {
      this.status = "error";
      this.error =
        "Add a model key, or use Groxbot’s included gateway, to talk to teammates.";
      await this.broadcastError();
      await this.broadcastStatus();
      return true;
    }
    const door = await personDoorContext(ns, homeRoomId, workspaceId);
    const members = await this.members();
    const roomName = (await this.ctx.storage.get<string>("name")) || "Room";
    const tools: AgentTool[] = [
      ...(await this.guestTools(homeRoomId, workspaceId)),
      ...this.roomFileTools(this.name, workspaceId),
    ];
    const system = await this.withOfficeSkills(
      buildOfficeSystemPrompt({
        identity: roomTurnSystem(
          composePersonDoorSoul({
            soulPrompt: brain.soulPrompt || door.soulPrompt,
            overlay: door.overlay,
            memory: door.memory,
          }),
          {
            name: roomName,
            selfName: target.name,
            members,
            around,
          },
        ),
        tools,
      }),
      messages.map((row) => row.message),
      { canReadSkills: officeCanReadSkills(tools) },
    );
    const assistantDraft: { id?: string } = {};
    this.status = "streaming";
    await this.broadcastStatus();
    try {
      const result = await runPiTurn({
        systemPrompt: system,
        messages: piGroupLoopMessages(messages, target.id),
        model: brain.model,
        streamFn: brain.streamFn,
        tools,
        signal: abort.signal,
        getSteeringMessages: () => this.roomSteer.drainMessages(),
        getFollowUpMessages: () => this.roomSteer.drainMessages(),
        onEvent: async (event) => {
          const incoming =
            "message" in event && event.message ? event.message : null;
          if (
            incoming?.role === "user" &&
            (event.type === "message_start" || event.type === "message_end")
          ) {
            const queued =
              event.type === "message_end"
                ? this.roomSteer.takeEmitted()
                : this.roomSteer.peekEmitted();
            const cloned = jsonClone(event);
            if (!cloned) return;
            const parsed = parsePiClientEvent({
              ...cloned,
              threadId: this.name,
              seq: this.roomSeq + 1,
              ...(queued
                ? { id: queued.id, metadata: queued.metadata }
                : {}),
            });
            if (!parsed) return;
            this.applyTurnEvent(parsed);
            await this.broadcastEvent(parsed);
            return;
          }
          const draftId = takePiAssistantDraft(assistantDraft, event);
          const cloned = jsonClone(event);
          if (!cloned) return;
          const parsed = parsePiClientEvent({
            ...cloned,
            threadId: this.name,
            seq: this.roomSeq + 1,
            ...(event.type === "message_update" ||
            event.type === "message_end" ||
            event.type === "message_start"
              ? { metadata: withRoomSpeaker(cloned.metadata, target) }
              : {}),
            ...(draftId &&
            (event.type === "message_update" ||
              event.type === "message_end" ||
              event.type === "message_start")
              ? { id: draftId }
              : {}),
          });
          if (!parsed) return;
          this.applyTurnEvent(parsed);
          await this.broadcastEvent(parsed);
        },
      });
      if (this.guestTurn !== abort) return true;
      if (result.stopReason === "aborted" || abort.signal.aborted) {
        this.status = "ready";
        await this.setFloor("");
        await this.broadcastStatus();
        return true;
      }
      if (result.stopReason === "error") {
        this.status = "error";
        this.error = result.errorMessage || "The model run failed.";
        await this.broadcastError();
        await this.broadcastStatus();
        return true;
      }
      if (!settle) return false;
      this.status = "ready";
      this.error = "";
      await this.setFloor("");
      await this.broadcastStatus();
      return false;
    } catch (error) {
      if (this.guestTurn !== abort || abort.signal.aborted) {
        this.status = "ready";
        await this.setFloor("");
        await this.broadcastStatus();
        return true;
      }
      this.status = "error";
      this.error =
        error instanceof Error ? error.message : "The model run failed.";
      await this.broadcastError();
      await this.broadcastStatus();
      return true;
    }
  }

  private async loadGuestBrain(botId: string, workspaceId: string) {
    const env = productEnv(this.env);
    const source = agentRuntimeSource(env);
    const { db } = createNeonHttpDb(env.databaseUrl);
    const [bot] = await db
      .select()
      .from(bots)
      .where(eq(bots.id, botId))
      .limit(1);
    if (!bot) {
      return {
        streamFn: null,
        model: piCompletionsModel(HOSTED_STARTER_MODEL),
        soulPrompt: "",
      };
    }
    const overlay = await resolveRunModel(
      db,
      bot,
      source,
      encryptionSecret(source, env.production),
    );
    const turnModel = overlay.model || HOSTED_STARTER_MODEL;
    const turnEnv = overlay.env;
    const streamFn = resolvePiStreamFn(turnEnv, {
      ai: this.env.AI,
      gatewayId: turnEnv.CLOUDFLARE_AI_GATEWAY_ID,
      metadata: {
        workspaceId,
        botId,
      },
    });
    const model = gatewayConfigured(turnEnv)
      ? resolvePiAiModel(loadGatewayConfig(turnEnv), turnModel)
      : piCompletionsModel(gatewayRequestModel(turnModel));
    return {
      streamFn,
      model,
      soulPrompt: teammatePrompt({
        ...bot,
        modelLabel: labelForModel(turnModel),
      }),
    };
  }

  private async guestTools(
    homeRoomId: string,
    workspaceId: string,
  ): Promise<AgentTool[]> {
    const ns = this.env.ROOM_ACTOR;
    if (!ns) return [];
    const specs = await personDoorTools(ns, homeRoomId, workspaceId);
    return specs.map((spec) => ({
      name: spec.name,
      label: spec.name,
      description: spec.description,
      parameters: (spec.parameters && typeof spec.parameters === "object"
        ? spec.parameters
        : { type: "object" }) as AgentTool["parameters"],
      execute: async (toolCallId, params) => {
        const result = await personDoorTool(ns, homeRoomId, workspaceId, {
          name: spec.name,
          params,
          toolCallId,
        });
        if (result && typeof result === "object" && "content" in result) {
          return result as Awaited<ReturnType<AgentTool["execute"]>>;
        }
        return {
          content: [{ type: "text", text: JSON.stringify(result ?? {}) }],
          details: result,
        };
      },
    }));
  }

  private roomFileTools(roomId: string, workspaceId: string): AgentTool[] {
    const ns = this.env.ROOM_ACTOR;
    if (!ns) return [];
    return [
      officeAgentTool({
        name: "room_list",
        description:
          "List papers in this room. Not your computer. Paths are room-root.",
        parameters: z.object({ path: z.string().optional() }),
        execute: async ({ path }) =>
          roomFileOp(ns, roomId, workspaceId, "list", {
            path: typeof path === "string" ? path : "",
          }),
      }),
      officeAgentTool({
        name: "room_read",
        description: "Read a paper in this room.",
        parameters: z.object({ path: z.string() }),
        execute: async ({ path }) =>
          roomFileOp(ns, roomId, workspaceId, "read", {
            path: String(path ?? ""),
          }),
      }),
      officeAgentTool({
        name: "room_write",
        description:
          "Write a paper in this room. Shared with everyone seated here.",
        parameters: z.object({
          path: z.string(),
          content: z.string(),
        }),
        execute: async ({ path, content }) =>
          roomFileOp(ns, roomId, workspaceId, "write", {
            path: String(path ?? ""),
            content: String(content ?? ""),
          }),
      }),
    ];
  }

  private async handleInit(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as {
      roomId?: unknown;
      workspaceId?: unknown;
      name?: unknown;
      botId?: unknown;
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
          const item = row as {
            id?: unknown;
            name?: unknown;
            homeRoomId?: unknown;
          };
          const id = typeof item.id === "string" ? item.id.trim() : "";
          const memberName =
            typeof item.name === "string" ? item.name.trim() : "";
          const homeRoomId =
            typeof item.homeRoomId === "string" ? item.homeRoomId.trim() : "";
          return id && memberName ? [{ id, name: memberName, homeRoomId }] : [];
        })
      : [];
    await this.ctx.storage.put("roomId", roomId);
    await this.ctx.storage.put("workspaceId", workspaceId);
    await this.ctx.storage.put("name", name);
    await this.ctx.storage.delete("kind");
    await this.ctx.storage.put("members", members);
    const botId = typeof body.botId === "string" ? body.botId.trim() : "";
    if (botId) {
      this.personId = botId;
      await this.ctx.storage.put("botId", botId);
      this.officeId = workspaceId;
      await this.ctx.storage.put("officeId", workspaceId);
    } else {
      await this.ctx.storage.delete("botId");
    }
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
    const body = (await request.json().catch(() => ({}))) as {
      event?: unknown;
    };
    const event = parsePiClientEvent({
      threadId: this.name,
      seq: this.roomSeq + 1,
      ...((body.event && typeof body.event === "object"
        ? body.event
        : {}) as Record<string, unknown>),
    });
    if (!event) return Response.json({ ok: true });
    this.status = "streaming";
    this.applyTurnEvent(event);
    await this.broadcastEvent(event);
    await this.broadcastStatus();
    return Response.json({ ok: true });
  }

  private async handleTurnComplete(request: Request): Promise<Response> {
    if (!(await this.requireWorkspace(request))) {
      return new Response("Forbidden", { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as {
      event?: unknown;
    };
    const event = parsePiClientEvent({
      threadId: this.name,
      seq: this.roomSeq + 1,
      ...((body.event && typeof body.event === "object"
        ? body.event
        : { type: "agent_end" }) as Record<string, unknown>),
    });
    if (event) {
      this.applyTurnEvent(event);
      await this.broadcastEvent(event);
    }
    this.status = "ready";
    this.error = "";
    await this.setFloor("");
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
    await this.setFloor("");
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
        { error: "Pick a paper in this room." },
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
        { error: "Name a paper in this room." },
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

  private applyTurnEvent(event: PiClientEvent): void {
    const view = applyPiOfficeEvent(
      {
        ...emptyPiOfficeView(this.name),
        messages: this.readLog(),
        seq: this.roomSeq,
      },
      event,
    );
    this.writeLog(piViewMessages(view));
  }

  private readLog(): PiBoundMessage[] {
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
    return parsePiLogMessages(payloads);
  }

  private writeLog(messages: PiBoundMessage[]): void {
    this.ctx.storage.sql.exec(`DELETE FROM room_chat`);
    for (const row of messages) {
      const safe = jsonClone(row);
      if (!safe) continue;
      this.ctx.storage.sql.exec(
        `INSERT INTO room_chat (id, payload) VALUES (?, ?)`,
        row.id,
        JSON.stringify(safe),
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

  private async broadcastEvent(
    event: Omit<PiClientEvent, "threadId" | "seq"> & {
      threadId?: string;
      seq?: number;
    },
  ): Promise<void> {
    this.roomSeq += 1;
    const payload = jsonClone({
      ...event,
      threadId: event.threadId || this.name,
      seq: event.seq ?? this.roomSeq,
    });
    if (!payload) return;
    await this.broadcast((sub) => sub.event(payload));
  }

  private broadcastStatus(): Promise<void> {
    return this.broadcast((sub) => sub.status(this.status));
  }

  private async setFloor(botId: string): Promise<void> {
    this.floorBotId = botId;
    if (botId) await this.ctx.storage.put("floorBotId", botId);
    else await this.ctx.storage.delete("floorBotId");
    await this.broadcastEvent({ type: "floor", botId });
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
