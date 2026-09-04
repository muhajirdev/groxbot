export class SectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SectionError";
  }
}

export function sectionName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new SectionError("Name this section.");
  if (name.length > 80) throw new SectionError("That name is too long.");
  return name;
}

export function nextSectionPosition(positions: readonly number[]): number {
  if (positions.length === 0) return 0;
  return Math.max(...positions) + 1;
}

export function isPinnedBot(bot: { pinnedAt?: string | null }): boolean {
  return Boolean(bot.pinnedAt);
}

export function compareSidebarBots(
  a: { pinnedAt?: string | null; lastAt: string },
  b: { pinnedAt?: string | null; lastAt: string },
): number {
  const aPinned = isPinnedBot(a);
  const bPinned = isPinnedBot(b);
  if (aPinned !== bPinned) return aPinned ? -1 : 1;
  return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
}

export type SidebarSectionBucket<T> = {
  section: { id: string; name: string; position: number };
  bots: T[];
};

export type SidebarLiveItem<B, R> =
  | { kind: "bot"; item: B }
  | { kind: "room"; item: R };

/** Mix 1:1 people and group rooms in one recency list. Pinned people stay on top. */
export function mixSidebarLive<
  B extends { pinnedAt?: string | null; lastAt: string },
  R extends { lastAt: string },
>(
  bots: readonly B[],
  rooms: readonly R[],
): SidebarLiveItem<B, R>[] {
  const items: SidebarLiveItem<B, R>[] = [
    ...bots.map((item) => ({ kind: "bot" as const, item })),
    ...rooms.map((item) => ({ kind: "room" as const, item })),
  ];
  items.sort((a, b) =>
    compareSidebarBots(
      a.kind === "bot" ? a.item : { pinnedAt: null, lastAt: a.item.lastAt },
      b.kind === "bot" ? b.item : { pinnedAt: null, lastAt: b.item.lastAt },
    ),
  );
  return items;
}

/** Faces for a room row: live members first, archived only if nobody is live. */
export function roomSidebarFaces<T extends { archivedAt: string | null }>(
  members: readonly T[],
  limit = 3,
): T[] {
  const live = members.filter((member) => !member.archivedAt);
  return (live.length > 0 ? live : [...members]).slice(0, limit);
}

export function groupSidebarBots<
  T extends {
    sectionId: string | null;
    pinnedAt?: string | null;
    lastAt: string;
  },
>(
  liveBots: readonly T[],
  sections: readonly { id: string; name: string; position: number }[],
): { ungrouped: T[]; sections: SidebarSectionBucket<T>[] } {
  const ordered = [...sections].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  );
  const bySection = new Map<string, T[]>();
  for (const section of ordered) bySection.set(section.id, []);
  const ungrouped: T[] = [];
  for (const bot of liveBots) {
    const bucket = bot.sectionId ? bySection.get(bot.sectionId) : undefined;
    if (bucket) bucket.push(bot);
    else ungrouped.push(bot);
  }
  ungrouped.sort(compareSidebarBots);
  return {
    ungrouped,
    sections: ordered.map((section) => ({
      section,
      bots: (bySection.get(section.id) ?? []).sort(compareSidebarBots),
    })),
  };
}
