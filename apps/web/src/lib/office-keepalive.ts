/** How many office threads to keep mounted for instant bot switches. */
export const OFFICE_KEEPALIVE_LIMIT = 8;

/**
 * LRU touch: move `botId` to the front, drop the oldest past `limit`.
 * First visit still mounts cold; return visits reuse the React tree.
 */
export function touchOfficeKeepAlive(
  mounted: readonly string[],
  botId: string,
  limit: number = OFFICE_KEEPALIVE_LIMIT,
): string[] {
  const id = botId.trim();
  if (!id || limit < 1) return [...mounted];
  const next = [id, ...mounted.filter((item) => item !== id)];
  return next.slice(0, limit);
}

export type OfficeKeepAlive = {
  /** Stable React mount order. Existing ids keep their index. */
  mounted: string[];
  /** Most-recent first; used only to decide who to evict. */
  lru: string[];
};

/**
 * Keep existing mount order so switching a cached bot does not shuffle DOM.
 * New ids append; eviction follows `lru`, not mount order.
 */
export function rememberOfficeKeepAlive(
  mounted: readonly string[],
  lru: readonly string[],
  botId: string,
  limit: number = OFFICE_KEEPALIVE_LIMIT,
): OfficeKeepAlive {
  const nextLru = touchOfficeKeepAlive(lru, botId, limit);
  const keep = new Set(nextLru);
  const nextMounted = mounted.filter((id) => keep.has(id));
  for (const id of nextLru) {
    if (!nextMounted.includes(id)) nextMounted.push(id);
  }
  return { mounted: nextMounted, lru: nextLru };
}

export function dropOfficeKeepAlive(
  mounted: readonly string[],
  botId: string,
): string[] {
  const id = botId.trim();
  if (!id) return [...mounted];
  return mounted.filter((item) => item !== id);
}

export function sameOfficeKeepAlive(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  );
}
