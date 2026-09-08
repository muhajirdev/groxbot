/**
 * Optimistic roster deletes vs in-flight `bots.list` / `rooms.list` applies.
 *
 * Query Collection applies successful query results asynchronously. A refetch
 * that started before delete (or a queued apply of that result) can re-insert
 * the row after `writeDelete`. Tombstones hide and re-drop those zombies until
 * the delete is rolled back (upsert) or the session ends.
 */

const pendingBotDeletes = new Set<string>();
const pendingRoomDeletes = new Set<string>();

export function markBotPendingDelete(id: string): void {
  const trimmed = id.trim();
  if (trimmed) pendingBotDeletes.add(trimmed);
}

export function clearBotPendingDelete(id: string): void {
  pendingBotDeletes.delete(id.trim());
}

export function isBotPendingDelete(id: string): boolean {
  return pendingBotDeletes.has(id.trim());
}

export function withoutPendingBotDeletes<T extends { id: string }>(
  rows: readonly T[],
): T[] {
  if (pendingBotDeletes.size === 0) return rows as T[];
  return rows.filter((row) => !pendingBotDeletes.has(row.id));
}

export function markRoomPendingDelete(id: string): void {
  const trimmed = id.trim();
  if (trimmed) pendingRoomDeletes.add(trimmed);
}

export function clearRoomPendingDelete(id: string): void {
  pendingRoomDeletes.delete(id.trim());
}

export function isRoomPendingDelete(id: string): boolean {
  return pendingRoomDeletes.has(id.trim());
}

export function withoutPendingRoomDeletes<T extends { id: string }>(
  rows: readonly T[],
): T[] {
  if (pendingRoomDeletes.size === 0) return rows as T[];
  return rows.filter((row) => !pendingRoomDeletes.has(row.id));
}

export function clearAllPendingRosterDeletes(): void {
  pendingBotDeletes.clear();
  pendingRoomDeletes.clear();
}

/** Test helper — pending ids currently marked for delete. */
export function peekPendingBotDeletes(): string[] {
  return [...pendingBotDeletes];
}

export function peekPendingRoomDeletes(): string[] {
  return [...pendingRoomDeletes];
}
