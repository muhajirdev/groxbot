import { describe, expect, it } from "vitest";
import {
  botMenuBox,
  botMenuItems,
  compareSidebarBots,
  isPinnedBot,
  nextBotIdAfterDelete,
} from "./sidebar";

describe("compareSidebarBots", () => {
  it("keeps pinned teammates above the rest", () => {
    const pinned = {
      pinnedAt: "2026-09-01T10:00:00.000Z",
      lastAt: "2026-08-01T00:00:00.000Z",
    };
    const recent = { pinnedAt: null, lastAt: "2026-09-01T12:00:00.000Z" };
    expect(compareSidebarBots(pinned, recent)).toBeLessThan(0);
    expect(compareSidebarBots(recent, pinned)).toBeGreaterThan(0);
  });

  it("sorts pinned and unpinned groups by last activity", () => {
    const olderPin = {
      pinnedAt: "2026-09-01T08:00:00.000Z",
      lastAt: "2026-08-01T00:00:00.000Z",
    };
    const newerPin = {
      pinnedAt: "2026-09-01T09:00:00.000Z",
      lastAt: "2026-08-20T00:00:00.000Z",
    };
    const older = { pinnedAt: null, lastAt: "2026-07-01T00:00:00.000Z" };
    const newer = { pinnedAt: null, lastAt: "2026-07-15T00:00:00.000Z" };
    const ranked = [older, newerPin, newer, olderPin].sort(compareSidebarBots);
    expect(ranked).toEqual([newerPin, olderPin, newer, older]);
  });
});

describe("isPinnedBot", () => {
  it("treats a timestamp as pinned", () => {
    expect(isPinnedBot({ pinnedAt: "2026-09-01T00:00:00.000Z" })).toBe(true);
    expect(isPinnedBot({ pinnedAt: null })).toBe(false);
  });
});

describe("botMenuItems", () => {
  it("offers pin and delete, then a named confirm", () => {
    expect(
      botMenuItems({ pinned: false, name: "Piper", phase: "actions" }),
    ).toEqual([
      { id: "pin", label: "Pin" },
      { id: "delete", label: "Delete", danger: true },
    ]);
    expect(
      botMenuItems({ pinned: true, name: "Piper", phase: "confirm-delete" }),
    ).toEqual([
      { id: "delete", label: "Delete Piper", danger: true },
      { id: "cancel-delete", label: "Cancel" },
    ]);
  });
});

describe("botMenuBox", () => {
  it("grows for the confirm labels", () => {
    expect(botMenuBox("confirm-delete").width).toBeGreaterThan(
      botMenuBox("actions").width,
    );
  });
});

describe("nextBotIdAfterDelete", () => {
  const piper = { id: "piper", archivedAt: null };
  const scout = { id: "scout", archivedAt: null };
  const old = { id: "old", archivedAt: "2026-08-01T00:00:00.000Z" };

  it("stays on the open teammate when another is deleted", () => {
    expect(nextBotIdAfterDelete([piper], "scout", "piper")).toBe("piper");
  });

  it("moves to another live teammate when the open one is deleted", () => {
    expect(nextBotIdAfterDelete([scout], "piper", "piper")).toBe("scout");
  });

  it("falls back to archived when the roster is empty of live bots", () => {
    expect(nextBotIdAfterDelete([old], "piper", "piper")).toBe("old");
  });

  it("returns null when nothing is left", () => {
    expect(nextBotIdAfterDelete([], "piper", "piper")).toBeNull();
  });
});
