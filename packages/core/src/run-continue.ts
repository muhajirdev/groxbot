import type { AgentRuntime, InitApp } from "@groxbot/adapter-kit";
import { labelForModel, type MessageBlock, type RunStatus } from "@groxbot/contracts";
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
  type ModelOverlay,
  resolveRunModel,
} from "./models.js";
import { composioUserId, listConnectedToolkits } from "./plugin-connections.js";
import { listPokeTeammates, pokeBot } from "./poke.js";
import { assertTransition } from "./run-state.js";
import { redactSecrets } from "./secret-box.js";
import { appendEvent, nextSeq } from "./threads.js";
import { recordModelUsage } from "./usage.js";

type RunRow = typeof runs.$inferSelect;
type BotRow = typeof bots.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;
type ThreadRow = typeof threads.$inferSelect;

export type OfficeTurn = {
  run: RunRow;
  bot: BotRow;
  task: TaskRow;
  thread: ThreadRow;
  overlay: ModelOverlay;
};

async function setRunStatus(
  db: Database,
  run: RunRow,
  status: RunStatus,
  extra: Partial<typeof runs.$inferInsert> = {},
): Promise<RunRow> {
  assertTransition(run.status as RunStatus, status);
  const [updated] = await db
    .update(runs)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(runs.id, run.id))
    .returning();
  if (!updated) throw new Error("Run missing after update");
  return updated;
}

export function teammatePrompt(bot: {
  name: string;
  title?: string | null;
  description: string;
  instructions: string;
  modelLabel?: string | null;
}): string {
  const job = bot.title?.trim();
  const who = job ? `${bot.name}, ${job}` : bot.name;
  const model = bot.modelLabel?.trim();
  return [
    `You are ${who}, a Groxbot teammate in this office thread.`,
    bot.description.trim(),
    bot.instructions.trim(),
    "This is office chat, not a document. Several humans may write here — user messages are tagged with the sender's name. Keep each reply short — a few sentences. Do the work with tools; don't narrate every step in the thread. Put long notes, tables, and drafts in a file on this computer, then send a short message with the path. Markdown is fine for a tight list or a snippet. Do not write an essay, a capability recap, or stacked headings unless they asked.",
    "This thread is your desk — files and a shell live on this computer. Files the human attaches land in inbox/. Read them from there. You can import npm packages in execute. Read a public page with fetch_url. If the body is HTML, or a PDF/doc on this computer, convert it with to_markdown. Do not open a browser just to read a page. Do not unpack binary streams in the shell. Do not send, pay, merge, or delete unless the human clearly asked.",
    "Learn as you go. Save durable facts with set_context on memory: people, prefs, decisions, dates, owners. Keep it dense. Who you are and how you sound lives in soul — grow it with set_context on soul as this desk teaches you (voice, taste, how you like to work). Keep your name. Longer private notes go in memory.md on this computer. Reusable how-to belongs in the office knowledge base — inside execute, knowledge.search then knowledge.read; knowledge.write at skills/<name>/SKILL.md (YAML name + description). Notes and files can live anywhere. Point at another office file with [constraints](how-we-work/constraints.md) — office-root path, not ../, not [[wikilinks]]. Search first so the path exists. Teammates will not see playbooks that only live on this computer. Do not copy the whole thread into memory or a skill.",
    "Do not mention Think or how you are hosted. If asked what you are, you are this teammate.",
    model ? `If asked which model you use, say ${model}.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Think appends this identity line; replace it so the model stays a Groxbot teammate. */
export const THINK_RUNTIME_LINE = "You are running inside a Think agent.";
export const TEAMMATE_RUNTIME_LINE = "You are this Groxbot teammate.";

export function rewriteThinkCapability(system: string): string {
  if (!system.includes(THINK_RUNTIME_LINE)) return system;
  return system.split(THINK_RUNTIME_LINE).join(TEAMMATE_RUNTIME_LINE);
}

export async function startOfficeRun(opts: {
  db: Database;
  runId: string;
  env?: NodeJS.ProcessEnv;
  guests?: GuestHub;
  skipGuestWait?: boolean;
}): Promise<OfficeTurn | null> {
  const { db, runId, guests } = opts;
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (run?.status !== "queued") return null;

  const [bot] = await db
    .select()
    .from(bots)
    .where(eq(bots.id, run.botId))
    .limit(1);
  if (!bot) return null;
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
    return null;
  }

  const guestEnabled = bot.guestKind !== "off";
  if (!opts.skipGuestWait && guestEnabled && !guests?.isOnline(bot.id)) {
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
    return null;
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
  if (!task || !thread) return null;

  await appendEvent(db, {
    workspaceId: run.workspaceId,
    threadId: run.threadId,
    botId: run.botId,
    type: "run.updated",
    payload: { runId, status: "running", text: "working…" },
    runId,
  });

  const sourceEnv = opts.env ?? process.env;
  const overlay = await resolveRunModel(
    db,
    bot,
    sourceEnv,
    encryptionSecret(sourceEnv),
  );
  if (!overlay.configured) {
    await failOfficeRun(db, current, missingModelMessage(overlay.model));
    return null;
  }
  return { run: current, bot, task, thread, overlay };
}

export async function failOfficeRun(
  db: Database,
  run: RunRow,
  message: string,
): Promise<void> {
  const redacted = redactSecrets(message);
  await setRunStatus(db, run, "failed", {
    error: redacted,
    completedAt: new Date(),
  });
  await appendEvent(db, {
    workspaceId: run.workspaceId,
    threadId: run.threadId,
    botId: run.botId,
    type: "run.updated",
    payload: { runId: run.id, status: "failed", text: redacted },
    runId: run.id,
  });
}

export async function completeOfficeRun(opts: {
  db: Database;
  run: RunRow;
  bot: BotRow;
  task: TaskRow;
  reply: string;
  initApp?: InitApp;
}): Promise<void> {
  const { db, bot, task } = opts;
  const [fresh] = await db
    .select()
    .from(runs)
    .where(eq(runs.id, opts.run.id))
    .limit(1);
  if (fresh?.status === "cancelled") return;

  const seq = await nextSeq(db, messages, opts.run.threadId);
  const assistantId = newId();
  const blocks: MessageBlock[] = [
    { kind: "text", text: opts.reply || "Done." },
  ];
  const intent = parseAppIntent(task.prompt);
  if (intent && opts.initApp) {
    const app = await stampApp({
      initApp: opts.initApp,
      workspaceId: opts.run.workspaceId,
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
    threadId: opts.run.threadId,
    seq,
    actorType: "bot",
    actorId: bot.id,
    blocks,
    runId: opts.run.id,
  });
  await appendEvent(db, {
    workspaceId: opts.run.workspaceId,
    threadId: opts.run.threadId,
    botId: opts.run.botId,
    type: "message.created",
    payload: {
      id: assistantId,
      seq,
      actorType: "bot",
      actorId: bot.id,
      blocks,
      runId: opts.run.id,
      createdAt: new Date().toISOString(),
    },
    runId: opts.run.id,
  });

  await setRunStatus(db, opts.run, "completed", { completedAt: new Date() });
  await db
    .update(tasks)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(tasks.id, task.id));
  await appendEvent(db, {
    workspaceId: opts.run.workspaceId,
    threadId: opts.run.threadId,
    botId: opts.run.botId,
    type: "run.updated",
    payload: { runId: opts.run.id, status: "completed", text: opts.reply },
    runId: opts.run.id,
  });
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
  const started = await startOfficeRun({
    db,
    runId,
    env: opts.env,
    guests,
  });
  if (!started) return;
  const { bot, task, thread, overlay } = started;
  const run = started.run;
  const current = started.run;
  const guestEnabled = bot.guestKind !== "off";

  const historyRows = await db
    .select()
    .from(messages)
    .where(eq(messages.threadId, run.threadId))
    .orderBy(asc(messages.seq));

  const history = historyRows.map((row) => historyTurn(row, bot.id));

  const controller = new AbortController();
  let reply = "";
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
        instructions: teammatePrompt({
          ...bot,
          modelLabel: labelForModel(overlay.model),
        }),
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
    await failOfficeRun(
      db,
      current,
      error instanceof Error ? error.message : "Run failed",
    );
    return;
  }

  await completeOfficeRun({
    db,
    run: current,
    bot,
    task,
    reply,
    initApp: opts.initApp,
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
