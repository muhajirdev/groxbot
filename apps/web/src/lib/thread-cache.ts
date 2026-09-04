import { type ThreadMeta, threadMetaCollection } from "./collections";

export const OFFICE_WORKING = "working…";

export function readCursor(botId: string): number {
  return threadMetaCollection.get(botId)?.cursor ?? -1;
}

export function readThreadMeta(botId: string): ThreadMeta | undefined {
  return threadMetaCollection.get(botId);
}

export function ensureThreadMeta(botId: string): ThreadMeta {
  const current = threadMetaCollection.get(botId);
  if (current) return current;
  const inserted: ThreadMeta = {
    botId,
    cursor: -1,
    working: "",
    error: "",
    opening: false,
  };
  threadMetaCollection.insert(inserted);
  return inserted;
}

export function dropThreadMeta(botId: string): void {
  if (!threadMetaCollection.has(botId)) return;
  threadMetaCollection.delete([botId]);
}

export function patchThreadMeta(
  botId: string,
  patch: Partial<Omit<ThreadMeta, "botId">>,
): void {
  const current = ensureThreadMeta(botId);
  if (
    (patch.cursor === undefined || patch.cursor === current.cursor) &&
    (patch.working === undefined || patch.working === current.working) &&
    (patch.error === undefined || patch.error === current.error) &&
    (patch.opening === undefined || patch.opening === current.opening)
  ) {
    return;
  }
  threadMetaCollection.update(botId, (draft) => {
    if (patch.cursor !== undefined) draft.cursor = patch.cursor;
    if (patch.working !== undefined) draft.working = patch.working;
    if (patch.error !== undefined) draft.error = patch.error;
    if (patch.opening !== undefined) draft.opening = patch.opening;
  });
}
