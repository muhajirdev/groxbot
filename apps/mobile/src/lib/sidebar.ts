import type { Bot } from "@groxbot/contracts";

export function isPinnedBot(bot: Pick<Bot, "pinnedAt">): boolean {
  return Boolean(bot.pinnedAt);
}

export function isArchivedBot(bot: Pick<Bot, "archivedAt">): boolean {
  return Boolean(bot.archivedAt);
}

export function firstLiveBot<T extends Pick<Bot, "archivedAt">>(
  bots: T[],
): T | undefined {
  return bots.find((bot) => !isArchivedBot(bot)) ?? bots[0];
}

export function compareSidebarBots(
  a: Pick<Bot, "pinnedAt" | "lastAt">,
  b: Pick<Bot, "pinnedAt" | "lastAt">,
): number {
  const aPinned = isPinnedBot(a);
  const bPinned = isPinnedBot(b);
  if (aPinned !== bPinned) return aPinned ? -1 : 1;
  return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
}

export function sortRoster<
  T extends Pick<Bot, "pinnedAt" | "lastAt" | "archivedAt">,
>(bots: T[]): T[] {
  return [...bots]
    .filter((bot) => !isArchivedBot(bot))
    .sort(compareSidebarBots);
}

export function sortArchived<
  T extends Pick<Bot, "pinnedAt" | "lastAt" | "archivedAt">,
>(bots: T[]): T[] {
  return [...bots].filter(isArchivedBot).sort(compareSidebarBots);
}

export function filterRoster<
  T extends Pick<Bot, "name" | "title" | "lastPreview">,
>(bots: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return bots;
  return bots.filter((bot) => {
    const hay = `${bot.name} ${bot.title} ${bot.lastPreview}`.toLowerCase();
    return hay.includes(needle);
  });
}
