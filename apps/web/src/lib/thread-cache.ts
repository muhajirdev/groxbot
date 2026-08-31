import { type ThreadMeta, threadMetaCollection } from "./collections";

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
  const current = threadMetaCollection.get(botId);
  if (
    current &&
    (patch.cursor === undefined || patch.cursor === current.cursor) &&
    (patch.working === undefined || patch.working === current.working) &&
    (patch.error === undefined || patch.error === current.error)
  ) {
    return;
  }
  threadMetaCollection.update(botId, (draft) => {
    if (patch.cursor !== undefined) draft.cursor = patch.cursor;
    if (patch.working !== undefined) draft.working = patch.working;
    if (patch.error !== undefined) draft.error = patch.error;
  });
}
