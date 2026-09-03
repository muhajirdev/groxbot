import type { Bot, MessageBlock, ProductEvent } from "@groxbot/contracts";
import { AvatarShape, GuestKind } from "@groxbot/contracts";
import {
  type bots,
  type Database,
  events,
  messages,
  threads,
} from "@groxbot/db";
import { and, asc, desc, eq, gt } from "drizzle-orm";

export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function previewFromBlocks(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .flatMap((block) => {
      if (!block || typeof block !== "object") return [];
      const row = block as {
        kind?: unknown;
        text?: unknown;
        title?: unknown;
      };
      if (row.kind === "text" && typeof row.text === "string")
        return [row.text];
      if (row.kind === "app" && typeof row.title === "string")
        return [row.title];
      return [];
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toBotDto(
  bot: typeof bots.$inferSelect,
  threadId: string,
  extras?: {
    online?: boolean;
    lastPreview?: string;
    lastAt?: Date | string | null;
  },
): Bot {
  const shape = AvatarShape.safeParse(bot.avatarShape);
  const guestKind = GuestKind.safeParse(bot.guestKind);
  const lastAt =
    extras?.lastAt instanceof Date
      ? extras.lastAt.toISOString()
      : (extras?.lastAt ?? bot.updatedAt.toISOString());
  return {
    id: bot.id,
    workspaceId: bot.workspaceId,
    name: bot.name,
    title: bot.title,
    description: bot.description,
    instructions: bot.instructions,
    avatarColor: bot.avatarColor,
    avatarShape: shape.success ? shape.data : "circle",
    parentBotId: bot.parentBotId,
    threadId,
    guestKind: guestKind.success ? guestKind.data : "off",
    guestOnline: extras?.online ?? false,
    model: bot.model ?? "",
    lastPreview: extras?.lastPreview ?? "",
    lastAt,
    archivedAt: iso(bot.archivedAt),
    pinnedAt: iso(bot.pinnedAt),
    createdAt: bot.createdAt.toISOString(),
    updatedAt: bot.updatedAt.toISOString(),
  };
}

export function toProductEvent(row: typeof events.$inferSelect): ProductEvent {
  return {
    type: row.type,
    threadId: row.threadId,
    botId: row.botId,
    runId: row.runId,
    seq: row.seq,
    payload: row.payload,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function nextSeq(
  db: Database,
  table: typeof messages | typeof events,
  threadId: string,
): Promise<number> {
  const [row] = await db
    .select({ seq: table.seq })
    .from(table)
    .where(eq(table.threadId, threadId))
    .orderBy(desc(table.seq))
    .limit(1);
  return (row?.seq ?? 0) + 1;
}

export async function appendThreadMessage(
  db: Database,
  input: {
    workspaceId: string;
    threadId: string;
    botId: string;
    actorType: "human" | "bot" | "system";
    actorId: string | null;
    blocks: MessageBlock[];
    runId?: string | null;
  },
): Promise<{ id: string; seq: number }> {
  const seq = await nextSeq(db, messages, input.threadId);
  const id = crypto.randomUUID();
  await db.insert(messages).values({
    id,
    threadId: input.threadId,
    seq,
    actorType: input.actorType,
    actorId: input.actorId,
    blocks: input.blocks,
    runId: input.runId ?? null,
  });
  await appendEvent(db, {
    workspaceId: input.workspaceId,
    threadId: input.threadId,
    botId: input.botId,
    type: "message.created",
    payload: {
      id,
      seq,
      actorType: input.actorType,
      actorId: input.actorId,
      blocks: input.blocks,
      runId: input.runId ?? null,
      createdAt: new Date().toISOString(),
    },
    runId: input.runId ?? null,
  });
  return { id, seq };
}

export async function appendEvent(
  db: Database,
  input: {
    workspaceId: string;
    threadId: string;
    botId: string;
    type: string;
    payload: Record<string, unknown>;
    runId?: string | null;
  },
): Promise<ProductEvent> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const seq = await nextSeq(db, events, input.threadId);
    const id = crypto.randomUUID();
    try {
      const [row] = await db
        .insert(events)
        .values({
          id,
          workspaceId: input.workspaceId,
          threadId: input.threadId,
          botId: input.botId,
          seq,
          type: input.type,
          payload: input.payload,
          runId: input.runId ?? null,
        })
        .returning();
      if (!row) throw new Error("Failed to append event");
      return toProductEvent(row);
    } catch (error) {
      if (!isUniqueSeqConflict(error) || attempt === 7) throw error;
    }
  }
  throw new Error("Failed to append event");
}

function isUniqueSeqConflict(error: unknown): boolean {
  let current: unknown = error;
  for (let i = 0; i < 4 && current && typeof current === "object"; i += 1) {
    const code = "code" in current ? current.code : undefined;
    const constraint =
      "constraint_name" in current ? current.constraint_name : undefined;
    if (code === "23505") return true;
    if (
      constraint === "events_thread_seq" ||
      constraint === "messages_thread_seq"
    )
      return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

export async function listEventsAfter(
  db: Database,
  threadId: string,
  cursor: number,
  limit = 80,
): Promise<ProductEvent[]> {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.threadId, threadId), gt(events.seq, cursor)))
    .orderBy(asc(events.seq))
    .limit(limit);
  return rows.map(toProductEvent);
}

/** v1 home office. Extra office threads for the same bot are schema-legal; this still returns one. */
export async function getHomeThread(
  db: Database,
  bot: { id: string; homeThreadId?: string | null },
): Promise<typeof threads.$inferSelect | undefined> {
  if (bot.homeThreadId) {
    const [home] = await db
      .select()
      .from(threads)
      .where(eq(threads.id, bot.homeThreadId))
      .limit(1);
    if (home) return home;
  }
  const [office] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.botId, bot.id), eq(threads.kind, "office")))
    .orderBy(asc(threads.createdAt))
    .limit(1);
  return office;
}
