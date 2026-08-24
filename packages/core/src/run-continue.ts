import type { AgentRuntime, InitApp } from "@groxbot/adapter-kit";
import type { MessageBlock, RunStatus } from "@groxbot/contracts";
import {
  bots,
  type Database,
  messages,
  runs,
  tasks,
  threads,
} from "@groxbot/db";
import { asc, eq } from "drizzle-orm";
import { parseAppIntent } from "./app-intent.js";
import { stampApp } from "./apps.js";
import type { GuestHub } from "./guest-hub.js";
import { GuestAgentRuntime } from "./guest-runtime.js";
import { newId } from "./ids.js";
import {
  encryptionSecret,
  missingModelMessage,
  resolveRunModel,
} from "./models.js";
import { composioUserId, listConnectedToolkits } from "./plugin-connections.js";
import { listPokeTeammates, pokeBot } from "./poke.js";
import { assertTransition } from "./run-state.js";
import { redactSecrets } from "./secret-box.js";
import { appendEvent, nextSeq } from "./threads.js";
import { recordModelUsage } from "./usage.js";

async function setRunStatus(
  db: Database,
  run: typeof runs.$inferSelect,
  status: RunStatus,
  extra: Partial<typeof runs.$inferInsert> = {},
): Promise<typeof runs.$inferSelect> {
  assertTransition(run.status as RunStatus, status);
  const [updated] = await db
    .update(runs)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(runs.id, run.id))
    .returning();
  if (!updated) throw new Error("Run missing after update");
  return updated;
}

export async function continueRun(opts: {
  db: Database;
  runtime: AgentRuntime;
  runId: string;
  env?: NodeJS.ProcessEnv;
  guests?: GuestHub;
  pokeStack?: string[];
  bindRuntime?: (overlay: {
    env: NodeJS.ProcessEnv;
    model: string;
    hosted?: boolean;
  }) => AgentRuntime;
  pluginTools?: (input: { workspaceId: string; toolkits: string[] }) =>
    | {
        search: (query: string) => Promise<string>;
        execute: (
          slug: string,
          args: Record<string, unknown>,
        ) => Promise<string>;
      }
    | undefined;
  initApp?: InitApp;
}): Promise<void> {
  const { db, runId, guests } = opts;
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) return;
  if (run.status !== "queued") return;

  const [bot] = await db
    .select()
    .from(bots)
    .where(eq(bots.id, run.botId))
    .limit(1);
  if (!bot) return;
  if (bot.archivedAt) {
    await setRunStatus(db, run, "cancelled", {
      completedAt: new Date(),
      error: "archived",
    });
    await db
      .update(tasks)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(tasks.id, run.taskId));
    await appendEvent(db, {
      workspaceId: run.workspaceId,
      threadId: run.threadId,
      botId: run.botId,
      type: "run.updated",
      payload: { runId, status: "cancelled", text: "archived" },
      runId,
    });
    return;
  }

  const guestEnabled = bot.guestKind !== "off";
  if (guestEnabled && !guests?.isOnline(bot.id)) {
    await appendEvent(db, {
      workspaceId: run.workspaceId,
      threadId: run.threadId,
      botId: run.botId,
      type: "run.updated",
      payload: {
        runId,
        status: "queued",
        text: `waiting for ${bot.guestKind}…`,
      },
      runId,
    });
    return;
  }

  let current = await setRunStatus(db, run, "leased", {
    leaseOwner: "worker",
    leaseFence: run.leaseFence + 1,
    leaseExpiresAt: new Date(Date.now() + 60_000),
  });
  current = await setRunStatus(db, current, "running", {
    startedAt: new Date(),
  });

  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, run.taskId))
    .limit(1);
  const [thread] = await db
    .select()
    .from(threads)
    .where(eq(threads.id, run.threadId))
    .limit(1);
  if (!task || !thread) return;

  await appendEvent(db, {
    workspaceId: run.workspaceId,
    threadId: run.threadId,
    botId: run.botId,
    type: "run.updated",
    payload: { runId, status: "running", text: "working…" },
    runId,
  });

  const historyRows = await db
    .select()
    .from(messages)
    .where(eq(messages.threadId, run.threadId))
    .orderBy(asc(messages.seq));

  const history = historyRows.map((row) => historyTurn(row, bot.id));

  const controller = new AbortController();
  let reply = "";
  const sourceEnv = opts.env ?? process.env;
  const overlay = await resolveRunModel(
    db,
    bot,
    sourceEnv,
    encryptionSecret(sourceEnv),
  );
  if (!overlay.configured) {
    const message = missingModelMessage(overlay.model);
    current = await setRunStatus(db, current, "failed", {
      error: message,
      completedAt: new Date(),
    });
    await appendEvent(db, {
      workspaceId: run.workspaceId,
      threadId: run.threadId,
      botId: run.botId,
      type: "run.updated",
      payload: { runId, status: "failed", text: message },
      runId,
    });
    return;
  }
  const bound = opts.bindRuntime ? opts.bindRuntime(overlay) : opts.runtime;
  const runner = guestEnabled && guests ? new GuestAgentRuntime(guests) : bound;
  const teammates = await listPokeTeammates(db, bot);
  const pluginToolkits = await listConnectedToolkits(db, run.workspaceId);
  const plugins = opts.pluginTools?.({
    workspaceId: run.workspaceId,
    toolkits: pluginToolkits,
  });
  const pokeStack = opts.pokeStack ?? [];
  const pokeTeammate =
    teammates.length === 0
      ? undefined
      : async (input: { name: string; message: string }) =>
          pokeBot({
            db,
            fromBot: bot,
            toName: input.name,
            text: input.message,
            userId: run.userId,
            pokeStack: [...pokeStack, bot.id],
            runTarget: async (nestedRunId) => {
              await continueRun({
                ...opts,
                runId: nestedRunId,
                pokeStack: [...pokeStack, bot.id],
              });
            },
          });
  try {
    for await (const event of runner.run(
      {
        botId: bot.id,
        threadId: thread.id,
        runId,
        prompt: task.prompt,
        instructions: bot.instructions || bot.description,
        history,
        model: overlay.model,
        teammates,
        pokeTeammate,
        composioUserId: composioUserId(run.workspaceId),
        pluginToolkits,
        composioSearch: plugins?.search,
        composioExecute: plugins?.execute,
      },
      {
        operationId: newId(),
        workspaceId: run.workspaceId,
        userId: run.userId,
        botId: bot.id,
        runId,
        signal: controller.signal,
      },
    )) {
      if (event.type === "progress") {
        await appendEvent(db, {
          workspaceId: run.workspaceId,
          threadId: run.threadId,
          botId: run.botId,
          type: "run.updated",
          payload: { runId, status: "running", text: event.text },
          runId,
        });
      }
      if (event.type === "text" && event.text) reply = event.text;
      if (event.type === "done" && event.text && !reply) reply = event.text;
      if (event.type === "error") throw new Error(event.text);
      if (event.type === "usage" && overlay.hosted) {
        await recordModelUsage(db, {
          workspaceId: run.workspaceId,
          userId: run.userId,
          botId: bot.id,
          runId,
          model: overlay.model,
          promptTokens: event.promptTokens,
          completionTokens: event.completionTokens,
          totalTokens: event.totalTokens,
        });
      }
    }
  } catch (error) {
    const message = redactSecrets(
      error instanceof Error ? error.message : "Run failed",
    );
    await setRunStatus(db, current, "failed", {
      error: message,
      completedAt: new Date(),
    });
    await appendEvent(db, {
      workspaceId: run.workspaceId,
      threadId: run.threadId,
      botId: run.botId,
      type: "run.updated",
      payload: { runId, status: "failed", text: message },
      runId,
    });
    return;
  }

  const [fresh] = await db
    .select()
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1);
  if (fresh?.status === "cancelled") return;

  const seq = await nextSeq(db, messages, run.threadId);
  const assistantId = newId();
  const blocks: MessageBlock[] = [{ kind: "text", text: reply || "Done." }];
  const intent = parseAppIntent(task.prompt);
  if (intent && opts.initApp) {
    const app = await stampApp({
      initApp: opts.initApp,
      workspaceId: run.workspaceId,
      templateId: intent.templateId,
      title: intent.title,
    });
    blocks.push({
      kind: "app",
      appId: app.id,
      templateId: app.templateId,
      title: app.title,
    });
  }
  await db.insert(messages).values({
    id: assistantId,
    threadId: run.threadId,
    seq,
    actorType: "bot",
    actorId: bot.id,
    blocks,
    runId,
  });
  await appendEvent(db, {
    workspaceId: run.workspaceId,
    threadId: run.threadId,
    botId: run.botId,
    type: "message.created",
    payload: {
      id: assistantId,
      seq,
      actorType: "bot",
      actorId: bot.id,
      blocks,
      runId,
      createdAt: new Date().toISOString(),
    },
    runId,
  });

  await setRunStatus(db, current, "completed", { completedAt: new Date() });
  await db
    .update(tasks)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(tasks.id, task.id));
  await appendEvent(db, {
    workspaceId: run.workspaceId,
    threadId: run.threadId,
    botId: run.botId,
    type: "run.updated",
    payload: { runId, status: "completed", text: reply },
    runId,
  });
}

function historyTurn(
  row: typeof messages.$inferSelect,
  botId: string,
): { role: "user" | "assistant" | "system"; content: string } {
  const blocks = row.blocks as MessageBlock[];
  const text = blocks
    .flatMap((block) => {
      if (block.kind === "text") return [block.text];
      if (block.kind === "app") return [`[${block.templateId}] ${block.title}`];
      return [];
    })
    .join("\n");
  if (row.actorType === "human") return { role: "user", content: text };
  if (row.actorType === "bot" && row.actorId === botId) {
    return { role: "assistant", content: text };
  }
  if (row.actorType === "bot") return { role: "user", content: text };
  return { role: "system", content: text };
}
