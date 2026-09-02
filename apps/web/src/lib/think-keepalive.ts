/** How many Think threads to keep mounted for instant bot switches. */
export const THINK_KEEPALIVE_LIMIT = 8;

/**
 * LRU touch: move `botId` to the front, drop the oldest past `limit`.
 * First visit still mounts cold; return visits reuse the React tree.
 */
export function touchThinkKeepAlive(
  mounted: readonly string[],
  botId: string,
  limit: number = THINK_KEEPALIVE_LIMIT,
): string[] {
  const id = botId.trim();
  if (!id || limit < 1) return [...mounted];
  const next = [id, ...mounted.filter((item) => item !== id)];
  return next.slice(0, limit);
}

export type ThinkKeepAlive = {
  /** Stable React mount order. Existing ids keep their index. */
  mounted: string[];
  /** Most-recent first; used only to decide who to evict. */
  lru: string[];
};

/**
 * Keep existing mount order so switching a cached bot does not shuffle DOM.
 * New ids append; eviction follows `lru`, not mount order.
 */
export function rememberThinkKeepAlive(
  mounted: readonly string[],
  lru: readonly string[],
  botId: string,
  limit: number = THINK_KEEPALIVE_LIMIT,
): ThinkKeepAlive {
  const nextLru = touchThinkKeepAlive(lru, botId, limit);
  const keep = new Set(nextLru);
  const nextMounted = mounted.filter((id) => keep.has(id));
  for (const id of nextLru) {
    if (!nextMounted.includes(id)) nextMounted.push(id);
  }
  return { mounted: nextMounted, lru: nextLru };
}

export function dropThinkKeepAlive(
  mounted: readonly string[],
  botId: string,
): string[] {
  const id = botId.trim();
  if (!id) return [...mounted];
  return mounted.filter((item) => item !== id);
}

export function sameThinkKeepAlive(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  );
}
