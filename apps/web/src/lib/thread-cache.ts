import type { ThreadMessage } from "@groxbot/contracts";
import {
  type CachedMessage,
  messagesCollection,
  patchBot,
  type ThreadMeta,
  threadMetaCollection,
} from "./collections";

export const THREAD_GC_MS = 30 * 60_000;

export function peekMessages(botId: string): CachedMessage[] {
  const rows: CachedMessage[] = [];
  messagesCollection.forEach((item) => {
    if (item.botId === botId) rows.push(item);
  });
  rows.sort((a, b) => a.seq - b.seq);
  return rows;
}

export function readCursor(botId: string): number {
  return threadMetaCollection.get(botId)?.cursor ?? -1;
}

export function ensureThreadMeta(botId: string): void {
  if (threadMetaCollection.has(botId)) return;
  threadMetaCollection.insert({
    botId,
    cursor: -1,
    working: "",
    error: "",
  });
}

export function patchThreadMeta(
  botId: string,
  patch: Partial<Omit<ThreadMeta, "botId">>,
): void {
  ensureThreadMeta(botId);
  threadMetaCollection.update(botId, (draft) => {
    if (patch.cursor !== undefined) draft.cursor = patch.cursor;
    if (patch.working !== undefined) draft.working = patch.working;
    if (patch.error !== undefined) draft.error = patch.error;
  });
}

export function upsertCachedMessage(
  botId: string,
  incoming: ThreadMessage,
): void {
  if (messagesCollection.has(incoming.id)) return;
  if (incoming.actorType === "human") {
    const incomingText = textOf(incoming);
    let pendingId: string | undefined;
    messagesCollection.forEach((item) => {
      if (
        pendingId === undefined &&
        item.botId === botId &&
        item.id.startsWith("pending:") &&
        textOf(item) === incomingText
      ) {
        pendingId = item.id;
      }
    });
    if (pendingId) messagesCollection.delete(pendingId);
  }
  messagesCollection.insert({ ...incoming, botId });
}

export function appendOptimisticMessage(
  botId: string,
  text: string,
): CachedMessage {
  let lastSeq = 0;
  messagesCollection.forEach((item) => {
    if (item.botId === botId && item.seq > lastSeq) lastSeq = item.seq;
  });
  const optimistic: CachedMessage = {
    id: `pending:${crypto.randomUUID()}`,
    seq: lastSeq + 1,
    botId,
    actorType: "human",
    actorId: null,
    blocks: [{ kind: "text", text }],
    runId: null,
    createdAt: new Date().toISOString(),
  };
  messagesCollection.insert(optimistic);
  patchThreadMeta(botId, { working: "working…", error: "" });
  touchBotPreview(botId, text);
  return optimistic;
}

export function failOptimisticSend(
  botId: string,
  id: string,
  error: string,
): void {
  if (messagesCollection.has(id)) messagesCollection.delete(id);
  patchThreadMeta(botId, { working: "", error });
}

export function touchBotPreview(botId: string, preview: string): void {
  patchBot(botId, {
    lastPreview: preview.slice(0, 140),
    lastAt: new Date().toISOString(),
  });
}

function textOf(message: ThreadMessage): string {
  return message.blocks
    .filter((block) => block.kind === "text")
    .map((block) => block.text)
    .join("\n");
}
