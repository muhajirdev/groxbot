import { describe, expect, it } from "vitest";
import {
  compareSidebarBots,
  firstLiveBot,
  isArchivedBot,
  isPinnedBot,
  sortRoster,
} from "./sidebar";

describe("compareSidebarBots", () => {
  it("keeps pinned teammates above the rest", () => {
    const pinned = {
      pinnedAt: "2026-09-01T10:00:00.000Z",
      lastAt: "2026-08-01T00:00:00.000Z",
    };
    const recent = { pinnedAt: null, lastAt: "2026-09-01T12:00:00.000Z" };
    expect(compareSidebarBots(pinned, recent)).toBeLessThan(0);
  });
});

describe("firstLiveBot", () => {
  it("skips archived teammates", () => {
    expect(
      firstLiveBot([
        { archivedAt: "2026-08-01T00:00:00.000Z" },
        { archivedAt: null },
      ])?.archivedAt,
    ).toBeNull();
  });
});

describe("sortRoster", () => {
  it("hides archived bots and ranks pinned first", () => {
    const ranked = sortRoster([
      {
        pinnedAt: null,
        lastAt: "2026-07-01T00:00:00.000Z",
        archivedAt: null,
      },
      {
        pinnedAt: "2026-09-01T08:00:00.000Z",
        lastAt: "2026-08-01T00:00:00.000Z",
        archivedAt: null,
      },
      {
        pinnedAt: null,
        lastAt: "2026-09-01T00:00:00.000Z",
        archivedAt: "2026-09-01T00:00:00.000Z",
      },
    ]);
    expect(ranked).toHaveLength(2);
    const first = ranked[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(isPinnedBot(first)).toBe(true);
    expect(ranked.every((bot) => !isArchivedBot(bot))).toBe(true);
  });
});
