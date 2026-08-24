import type {
  AgentRuntimeEvent,
  EnqueueJob,
  GuestAgentKind,
  HostToGuest,
} from "@groxbot/adapter-kit";
import { GuestAgentKind as GuestAgentKindSchema } from "@groxbot/contracts";
import { bots, type Database, guestConnectors, runs } from "@groxbot/db";
import { and, eq } from "drizzle-orm";
import type { GuestHub } from "./guest-hub.js";
import { parseGuestToken, tokenMatches } from "./guest-token.js";
import { appendEvent, getHomeThread } from "./threads.js";

export interface GuestHttpContext {
  db: Database;
  hub: GuestHub;
  enqueue: EnqueueJob;
}

function parseRuntimeEvent(value: unknown): AgentRuntimeEvent | null {
  if (!value || typeof value !== "object") return null;
  const type = "type" in value ? String(value.type) : "";
  const text =
    "text" in value && typeof value.text === "string" ? value.text : "";
  if (type === "progress") return { type, text };
  if (type === "text") return { type, text };
  if (type === "error") return { type, text };
  if (type === "done") return text ? { type, text } : { type };
  return null;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function markConnector(
  db: Database,
  botId: string,
  patch: { online: boolean; lastSeenAt?: Date | null },
): Promise<void> {
  await db
    .update(guestConnectors)
    .set({
      online: patch.online,
      lastSeenAt:
        patch.lastSeenAt === undefined
          ? patch.online
            ? new Date()
            : null
          : patch.lastSeenAt,
      updatedAt: new Date(),
    })
    .where(eq(guestConnectors.botId, botId));
}

async function emitGuest(
  db: Database,
  botId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const [bot] = await db.select().from(bots).where(eq(bots.id, botId)).limit(1);
  const thread = bot ? await getHomeThread(db, bot) : undefined;
  if (!bot || !thread) return;
  await appendEvent(db, {
    workspaceId: bot.workspaceId,
    threadId: thread.id,
    botId,
    type: "guest.updated",
    payload,
  });
}

async function resumeQueued(
  db: Database,
  enqueue: EnqueueJob,
  botId: string,
): Promise<void> {
  const queued = await db
    .select()
    .from(runs)
    .where(and(eq(runs.botId, botId), eq(runs.status, "queued")));
  for (const run of queued) {
    await enqueue({
      botId,
      name: "run.continue",
      payload: { botId, runId: run.id, taskId: run.taskId },
    });
  }
}

async function hello(
  ctx: GuestHttpContext,
  body: Record<string, unknown>,
): Promise<Response> {
  const token = String(body.token ?? "");
  const kindParsed = GuestAgentKindSchema.safeParse(body.kind);
  if (!token || !kindParsed.success) {
    return json(400, { error: "token and kind are required" });
  }
  const kind: GuestAgentKind = kindParsed.data;
  const parsed = parseGuestToken(token);
  if (!parsed) return json(401, { error: "invalid guest token" });
  const [connector] = await ctx.db
    .select()
    .from(guestConnectors)
    .where(eq(guestConnectors.id, parsed.connectorId))
    .limit(1);
  if (
    !connector ||
    connector.revokedAt ||
    !tokenMatches(token, connector.tokenHash)
  ) {
    return json(401, { error: "invalid guest token" });
  }
  const [bot] = await ctx.db
    .select()
    .from(bots)
    .where(eq(bots.id, connector.botId))
    .limit(1);
  if (!bot || bot.guestKind === "off") {
    return json(403, { error: "guest runtime is not enabled on this bot" });
  }
  if (bot.archivedAt) {
    return json(403, { error: "this bot is archived" });
  }
  if (bot.guestKind !== kind) {
    return json(403, {
      error: `this bot expects ${bot.guestKind}, not ${kind}`,
    });
  }
  const session = ctx.hub.hello(bot.id, kind);
  await markConnector(ctx.db, bot.id, { online: true });
  await emitGuest(ctx.db, bot.id, {
    kind,
    connected: true,
    name: bot.name,
  });
  await resumeQueued(ctx.db, ctx.enqueue, bot.id);
  return json(200, {
    sessionId: session.id,
    botId: bot.id,
    name: bot.name,
    kind,
  });
}

async function wait(
  ctx: GuestHttpContext,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  const sessionId = String(body.sessionId ?? "");
  const session = ctx.hub.get(sessionId);
  if (!session) return json(404, { error: "unknown session" });
  await markConnector(ctx.db, session.botId, { online: true });
  const message: HostToGuest = await ctx.hub.wait(sessionId, 2_000, signal);
  return json(200, message);
}

async function event(
  ctx: GuestHttpContext,
  body: Record<string, unknown>,
): Promise<Response> {
  const sessionId = String(body.sessionId ?? "");
  const runId = String(body.runId ?? "");
  const eventBody = body.event;
  if (!sessionId || !runId || !eventBody || typeof eventBody !== "object") {
    return json(400, { error: "sessionId, runId, and event are required" });
  }
  const parsed = parseRuntimeEvent(eventBody);
  if (!parsed) return json(400, { error: "invalid event" });
  const ok = ctx.hub.onEvent(sessionId, runId, parsed);
  if (!ok) return json(404, { error: "no active run" });
  return json(200, { ok: true });
}

async function bye(
  ctx: GuestHttpContext,
  body: Record<string, unknown>,
): Promise<Response> {
  const sessionId = String(body.sessionId ?? "");
  const session = ctx.hub.get(sessionId);
  if (session) {
    ctx.hub.bye(sessionId);
    await markConnector(ctx.db, session.botId, { online: false });
    await emitGuest(ctx.db, session.botId, {
      kind: session.kind,
      connected: false,
    });
  }
  return json(200, { ok: true });
}

export async function handleGuestRequest(
  request: Request,
  ctx: GuestHttpContext,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/guest")) return null;
  if (request.method === "GET" && url.pathname === "/guest/health") {
    return json(200, { ok: true });
  }
  if (request.method !== "POST") return json(405, { error: "method" });
  const body = await readBody(request);
  if (url.pathname === "/guest/hello") return hello(ctx, body);
  if (url.pathname === "/guest/wait") return wait(ctx, body, request.signal);
  if (url.pathname === "/guest/event") return event(ctx, body);
  if (url.pathname === "/guest/bye") return bye(ctx, body);
  return json(404, { error: "not found" });
}

export function nodeRequestFrom(
  req: import("node:http").IncomingMessage,
  chunks: Buffer,
): Request {
  const host = req.headers.host ?? "127.0.0.1";
  const url = `http://${host}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  const method = req.method ?? "GET";
  return new Request(url, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : chunks,
  });
}
