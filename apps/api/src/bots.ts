import { type Bot, validateModelId } from "@groxbot/contracts";
import {
  appendEvent,
  createRoom,
  encryptionSecret,
  ensureBotOwnRoom,
  getHomeThread,
  missingModelMessage,
  moveBotToSection,
  newId,
  nextSeq,
  previewFromBlocks,
  resolveRunModel,
  SectionError,
  toBotDto,
} from "@groxbot/core";
import {
  bots,
  guestConnectors,
  memoryDocuments,
  messages,
  rooms,
  runs,
  tasks,
  threadMembers,
  threads,
} from "@groxbot/db";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import type { RpcContext } from "./context.js";
import { agentRuntimeSource } from "./env.js";
import type { Actor } from "./session.js";

const STALE_MS = 60_000;

function connectorOnline(
  row:
    | {
        online: boolean;
        revokedAt: Date | null;
        lastSeenAt: Date | null;
      }
    | undefined,
): boolean {
  if (!row || row.revokedAt || !row.online || !row.lastSeenAt) return false;
  return Date.now() - row.lastSeenAt.getTime() < STALE_MS;
}

export async function getBotThread(
  context: RpcContext,
  actor: Actor,
  botId: string,
) {
  const [bot] = await context.db
    .select()
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, actor.workspaceId)))
    .limit(1);
  if (!bot) throw new ORPCError("NOT_FOUND", { message: "Bot not found" });
  const thread = await getHomeThread(context.db, bot);
  if (!thread) throw new ORPCError("NOT_FOUND", { message: "Thread missing" });
  return { bot: await withOwnRoom(context, actor, bot), thread };
}

/** Live MCP OAuth has to sit on some home actor; the catalog is still workspace-wide. */
export async function getMcpHostBot(
  context: RpcContext,
  actor: Actor,
  botId?: string,
) {
  if (botId) {
    const { bot } = await getBotThread(context, actor, botId);
    if (!bot.archivedAt) return bot;
  }
  const [row] = await context.db
    .select()
    .from(bots)
    .where(
      and(eq(bots.workspaceId, actor.workspaceId), isNull(bots.archivedAt)),
    )
    .orderBy(asc(bots.createdAt))
    .limit(1);
  if (!row) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message: "Hire a teammate before connecting MCP.",
    });
  }
  return withOwnRoom(context, actor, row);
}

function assertBotActive(bot: { archivedAt: Date | null }) {
  if (bot.archivedAt) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message: "This teammate is archived.",
    });
  }
}

async function withOwnRoom(
  context: RpcContext,
  actor: Actor,
  bot: typeof bots.$inferSelect,
): Promise<typeof bots.$inferSelect> {
  if (bot.homeRoomId) return bot;
  const homeRoomId = await ensureBotOwnRoom(context.db, {
    workspaceId: actor.workspaceId,
    userId: actor.userId,
    botId: bot.id,
    name: bot.name,
    homeRoomId: bot.homeRoomId,
  });
  if (context.initRoom) {
    await context.initRoom(homeRoomId, {
      workspaceId: actor.workspaceId,
      name: bot.name,
      botId: bot.id,
      members: [{ id: bot.id, name: bot.name, homeRoomId }],
    });
  }
  return { ...bot, homeRoomId };
}

export async function listBots(
  context: RpcContext,
  actor: Actor,
): Promise<Bot[]> {
  const rows = await context.db
    .select()
    .from(bots)
    .where(eq(bots.workspaceId, actor.workspaceId))
    .orderBy(desc(bots.updatedAt));
  const threadRows = await context.db
    .select()
    .from(threads)
    .where(eq(threads.workspaceId, actor.workspaceId));
  const threadByBot = new Map(
    rows
      .filter((bot) => bot.homeThreadId)
      .map((bot) => [bot.id, bot.homeThreadId as string]),
  );
  for (const row of threadRows) {
    if (row.kind !== "office" || !row.botId || threadByBot.has(row.botId)) {
      continue;
    }
    threadByBot.set(row.botId, row.id);
  }
  const connectors =
    rows.length === 0
      ? []
      : await context.db
          .select()
          .from(guestConnectors)
          .where(
            inArray(
              guestConnectors.botId,
              rows.map((row) => row.id),
            ),
          );
  const onlineByBot = new Map(
    connectors.map((row) => [row.botId, connectorOnline(row)]),
  );
  const threadIds = [...threadByBot.values()];
  const lastByThread = new Map<string, { preview: string; at: Date }>();
  if (threadIds.length > 0) {
    const recent = await context.db
      .select({
        threadId: messages.threadId,
        blocks: messages.blocks,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(inArray(messages.threadId, threadIds))
      .orderBy(desc(messages.createdAt));
    for (const row of recent) {
      if (lastByThread.has(row.threadId)) continue;
      lastByThread.set(row.threadId, {
        preview: previewFromBlocks(row.blocks),
        at: row.createdAt,
      });
    }
  }
  const listed: Bot[] = [];
  for (const bot of rows) {
    const threadId = threadByBot.get(bot.id);
    if (!threadId) continue;
    const withHome = await withOwnRoom(context, actor, bot);
    const last = lastByThread.get(threadId);
    listed.push(
      toBotDto(withHome, threadId, {
        online: onlineByBot.get(bot.id),
        lastPreview: last?.preview,
        lastAt: last?.at,
      }),
    );
  }
  return listed;
}

export async function createBot(
  context: RpcContext,
  actor: Actor,
  input: {
    id?: string;
    name: string;
    title?: string;
    description: string;
    instructions: string;
    avatarColor: string;
    avatarShape: string;
    homeRoomId?: string;
  },
): Promise<Bot> {
  const botId = input.id?.trim() || newId();
  const threadId = newId();
  const homeRoomId = input.homeRoomId?.trim() || newId();
  const now = new Date();
  await context.db.insert(bots).values({
    id: botId,
    workspaceId: actor.workspaceId,
    userId: actor.userId,
    name: input.name,
    title: input.title?.trim() ?? "",
    description: input.description,
    instructions: input.instructions,
    avatarColor: input.avatarColor,
    avatarShape: input.avatarShape,
    guestKind: "off",
    createdAt: now,
    updatedAt: now,
  });
  await context.db.insert(threads).values({
    id: threadId,
    workspaceId: actor.workspaceId,
    kind: "office",
    botId,
    createdAt: now,
  });
  await context.db.insert(threadMembers).values({
    id: newId(),
    threadId,
    userId: actor.userId,
    role: "owner",
    createdAt: now,
  });
  const home = await createRoom(context.db, {
    workspaceId: actor.workspaceId,
    userId: actor.userId,
    name: input.name,
    memberBotIds: [botId],
    id: homeRoomId,
    own: true,
  });
  await context.db
    .update(bots)
    .set({ homeThreadId: threadId, homeRoomId: home.id, updatedAt: now })
    .where(eq(bots.id, botId));
  if (context.initRoom) {
    await context.initRoom(home.id, {
      workspaceId: actor.workspaceId,
      name: input.name,
      botId,
      members: [{ id: botId, name: input.name, homeRoomId: home.id }],
    });
  }
  const [bot] = await context.db
    .select()
    .from(bots)
    .where(eq(bots.id, botId))
    .limit(1);
  if (!bot)
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Bot create failed",
    });
  return toBotDto(bot, threadId);
}

export async function updateBot(
  context: RpcContext,
  actor: Actor,
  input: {
    botId: string;
    name?: string;
    title?: string;
    description?: string;
    instructions?: string;
    avatarColor?: string;
    avatarShape?: string;
    model?: string;
  },
): Promise<Bot> {
  const { bot, thread } = await getBotThread(context, actor, input.botId);
  const model = input.model !== undefined ? input.model.trim() : bot.model;
  if (input.model !== undefined && model) {
    const problem = validateModelId(model);
    if (problem) throw new ORPCError("BAD_REQUEST", { message: problem });
  }
  await context.db
    .update(bots)
    .set({
      name: input.name ?? bot.name,
      title: input.title !== undefined ? input.title.trim() : bot.title,
      description: input.description ?? bot.description,
      instructions: input.instructions ?? bot.instructions,
      avatarColor: input.avatarColor ?? bot.avatarColor,
      avatarShape: input.avatarShape ?? bot.avatarShape,
      model,
      updatedAt: new Date(),
    })
    .where(eq(bots.id, bot.id));
  const [updated] = await context.db
    .select()
    .from(bots)
    .where(eq(bots.id, bot.id))
    .limit(1);
  if (!updated) throw new ORPCError("NOT_FOUND", { message: "Bot not found" });
  return toBotDto(updated, thread.id);
}

export async function archiveBot(
  context: RpcContext,
  actor: Actor,
  botId: string,
): Promise<Bot> {
  const { bot, thread } = await getBotThread(context, actor, botId);
  if (bot.archivedAt) return toBotDto(bot, thread.id);
  await stopBotRuns(context, actor, botId);
  try {
    await context.routines?.suspend?.(botId, true);
  } catch (error) {
    console.error("bot actor suspend routines", botId, error);
  }
  const now = new Date();
  const [updated] = await context.db
    .update(bots)
    .set({ archivedAt: now, updatedAt: now })
    .where(eq(bots.id, bot.id))
    .returning();
  if (!updated) throw new ORPCError("NOT_FOUND", { message: "Bot not found" });
  return toBotDto(updated, thread.id);
}

export async function unarchiveBot(
  context: RpcContext,
  actor: Actor,
  botId: string,
): Promise<Bot> {
  const { bot, thread } = await getBotThread(context, actor, botId);
  if (!bot.archivedAt) return toBotDto(bot, thread.id);
  try {
    await context.routines?.suspend?.(botId, false);
  } catch (error) {
    console.error("bot actor resume routines", botId, error);
  }
  const now = new Date();
  const [updated] = await context.db
    .update(bots)
    .set({ archivedAt: null, updatedAt: now })
    .where(eq(bots.id, bot.id))
    .returning();
  if (!updated) throw new ORPCError("NOT_FOUND", { message: "Bot not found" });
  return toBotDto(updated, thread.id);
}

export async function pinBot(
  context: RpcContext,
  actor: Actor,
  botId: string,
): Promise<Bot> {
  const { bot, thread } = await getBotThread(context, actor, botId);
  if (bot.pinnedAt) return toBotDto(bot, thread.id);
  const now = new Date();
  const [updated] = await context.db
    .update(bots)
    .set({ pinnedAt: now, updatedAt: now })
    .where(eq(bots.id, bot.id))
    .returning();
  if (!updated) throw new ORPCError("NOT_FOUND", { message: "Bot not found" });
  return toBotDto(updated, thread.id);
}

export async function unpinBot(
  context: RpcContext,
  actor: Actor,
  botId: string,
): Promise<Bot> {
  const { bot, thread } = await getBotThread(context, actor, botId);
  if (!bot.pinnedAt) return toBotDto(bot, thread.id);
  const now = new Date();
  const [updated] = await context.db
    .update(bots)
    .set({ pinnedAt: null, updatedAt: now })
    .where(eq(bots.id, bot.id))
    .returning();
  if (!updated) throw new ORPCError("NOT_FOUND", { message: "Bot not found" });
  return toBotDto(updated, thread.id);
}

export async function moveBot(
  context: RpcContext,
  actor: Actor,
  input: { botId: string; sectionId: string | null },
): Promise<Bot> {
  const { thread } = await getBotThread(context, actor, input.botId);
  try {
    const updated = await moveBotToSection(context.db, {
      workspaceId: actor.workspaceId,
      botId: input.botId,
      sectionId: input.sectionId,
    });
    return toBotDto(updated, thread.id);
  } catch (error) {
    if (error instanceof SectionError) {
      const notFound =
        error.message === "That section is missing." ||
        error.message === "Bot not found.";
      throw new ORPCError(notFound ? "NOT_FOUND" : "BAD_REQUEST", {
        message: error.message,
      });
    }
    throw error;
  }
}

export async function deleteBot(
  context: RpcContext,
  actor: Actor,
  botId: string,
): Promise<{ ok: true }> {
  const { bot } = await getBotThread(context, actor, botId);
  const homeRoomId = bot.homeRoomId;
  await stopBotRuns(context, actor, botId);
  const now = new Date();
  await context.db
    .update(bots)
    .set({ homeThreadId: null, homeRoomId: null, updatedAt: now })
    .where(eq(bots.id, bot.id));
  await context.db
    .update(bots)
    .set({ parentBotId: null, updatedAt: now })
    .where(eq(bots.parentBotId, bot.id));
  await context.db
    .delete(memoryDocuments)
    .where(eq(memoryDocuments.botId, bot.id));
  await context.db
    .delete(threads)
    .where(
      or(
        eq(threads.botId, bot.id),
        eq(threads.aBotId, bot.id),
        eq(threads.bBotId, bot.id),
      ),
    );
  const removed = await context.db
    .delete(bots)
    .where(and(eq(bots.id, bot.id), eq(bots.workspaceId, actor.workspaceId)))
    .returning();
  if (removed.length === 0) {
    throw new ORPCError("NOT_FOUND", { message: "Bot not found" });
  }
  if (homeRoomId) {
    await context.db.delete(rooms).where(eq(rooms.id, homeRoomId));
  }
  try {
    await context.forgetBot?.(homeRoomId || bot.id);
  } catch (error) {
    console.error("bot actor destroy", bot.id, error);
  }
  return { ok: true };
}

export async function sendMessage(
  context: RpcContext,
  actor: Actor,
  botId: string,
  text: string,
) {
  const { bot, thread } = await getBotThread(context, actor, botId);
  assertBotActive(bot);
  const overlay = await resolveRunModel(
    context.db,
    bot,
    agentRuntimeSource(context.env),
    encryptionSecret(
      {
        ENCRYPTION_KEY: context.env.encryptionKey,
        BETTER_AUTH_SECRET: context.env.authSecret,
      },
      context.env.production,
    ),
  );
  if (!overlay.configured) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message: missingModelMessage(overlay.model),
    });
  }
  const seq = await nextSeq(context.db, messages, thread.id);
  const messageId = newId();
  const taskId = newId();
  const runId = newId();
  const blocks = [{ kind: "text" as const, text }];

  await context.db.insert(messages).values({
    id: messageId,
    threadId: thread.id,
    seq,
    actorType: "human",
    actorId: actor.userId,
    blocks,
  });
  await appendEvent(context.db, {
    workspaceId: actor.workspaceId,
    threadId: thread.id,
    botId: bot.id,
    type: "message.created",
    payload: {
      id: messageId,
      seq,
      actorType: "human",
      actorId: actor.userId,
      blocks,
      runId,
      createdAt: new Date().toISOString(),
    },
    runId,
  });

  await context.db.insert(tasks).values({
    id: taskId,
    workspaceId: actor.workspaceId,
    botId: bot.id,
    threadId: thread.id,
    userId: actor.userId,
    prompt: text,
    status: "queued",
  });
  await context.db.insert(runs).values({
    id: runId,
    workspaceId: actor.workspaceId,
    botId: bot.id,
    threadId: thread.id,
    taskId,
    userId: actor.userId,
    status: "queued",
    trigger: "user",
  });
  await appendEvent(context.db, {
    workspaceId: actor.workspaceId,
    threadId: thread.id,
    botId: bot.id,
    type: "run.updated",
    payload: { runId, status: "queued", text: "working…" },
    runId,
  });

  await context.enqueue({
    botId: bot.id,
    name: "run.continue",
    payload: { botId: bot.id, runId, taskId },
  });

  return { taskId, runId, seq };
}

export async function stopBotRuns(
  context: RpcContext,
  actor: Actor,
  botId: string,
): Promise<void> {
  const { thread } = await getBotThread(context, actor, botId);
  const active = await context.db
    .select()
    .from(runs)
    .where(and(eq(runs.botId, botId), eq(runs.status, "running")));
  const queued = await context.db
    .select()
    .from(runs)
    .where(and(eq(runs.botId, botId), eq(runs.status, "queued")));
  for (const run of [...active, ...queued]) {
    await context.db
      .update(runs)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
        completedAt: new Date(),
      })
      .where(eq(runs.id, run.id));
    await appendEvent(context.db, {
      workspaceId: actor.workspaceId,
      threadId: thread.id,
      botId,
      type: "run.updated",
      payload: { runId: run.id, status: "cancelled", text: "stopped" },
      runId: run.id,
    });
  }
  context.guests.abort(botId);
  await context.enqueue({
    botId,
    name: "run.abort",
    payload: {
      botId,
      runIds: [...active, ...queued].map((run) => run.id),
    },
  });
}
