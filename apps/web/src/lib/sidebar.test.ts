import { describe, expect, it } from "vitest";
import {
  botMenuBox,
  botMenuItems,
  compareSidebarBots,
  groupSidebarBots,
  isPinnedBot,
  mixSidebarLive,
  nextBotIdAfterDelete,
  roomMenuItems,
  sectionMenuItems,
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
  it("offers pin, archive, and delete, then a named confirm", () => {
    expect(
      botMenuItems({ pinned: false, name: "Piper", phase: "actions" }),
    ).toEqual([
      { id: "pin", label: "Pin" },
      { id: "archive", label: "Archive" },
      { id: "delete", label: "Delete", danger: true },
    ]);
    expect(
      botMenuItems({
        pinned: false,
        archived: true,
        name: "Piper",
        phase: "actions",
      }),
    ).toEqual([
      { id: "pin", label: "Pin" },
      { id: "archive", label: "Unarchive" },
      { id: "delete", label: "Delete", danger: true },
    ]);
    expect(
      botMenuItems({
        pinned: false,
        name: "Piper",
        phase: "actions",
        sections: [{ id: "sales", name: "Sales" }],
      }),
    ).toEqual([
      { id: "pin", label: "Pin" },
      { id: "archive", label: "Archive" },
      { id: "move", label: "Move to…" },
      { id: "delete", label: "Delete", danger: true },
    ]);
    expect(
      botMenuItems({ pinned: true, name: "Piper", phase: "confirm-delete" }),
    ).toEqual([
      { id: "delete", label: "Delete Piper", danger: true },
      { id: "cancel-delete", label: "Cancel" },
    ]);
  });

  it("lists ungrouped and named sections in the move phase", () => {
    expect(
      botMenuItems({
        pinned: false,
        name: "Piper",
        phase: "move",
        sections: [{ id: "sales", name: "Sales" }],
      }),
    ).toEqual([
      { id: "move-to", sectionId: null, label: "Ungrouped" },
      { id: "move-to", sectionId: "sales", label: "Sales" },
    ]);
  });
});

describe("botMenuBox", () => {
  it("grows for the confirm labels", () => {
    expect(botMenuBox("confirm-delete").width).toBeGreaterThan(
      botMenuBox("actions").width,
    );
  });

  it("grows with the move list", () => {
    expect(botMenuBox("move", 4).height).toBeGreaterThan(
      botMenuBox("move", 1).height,
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

describe("groupSidebarBots", () => {
  it("keeps ungrouped people above named sections", () => {
    const grouped = groupSidebarBots(
      [
        {
          id: "piper",
          sectionId: null,
          pinnedAt: null,
          lastAt: "2026-09-02T00:00:00.000Z",
        },
        {
          id: "scout",
          sectionId: "sales",
          pinnedAt: null,
          lastAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      [{ id: "sales", name: "Sales", position: 0 }],
    );
    expect(grouped.ungrouped.map((bot) => bot.id)).toEqual(["piper"]);
    expect(grouped.sections[0]?.bots.map((bot) => bot.id)).toEqual(["scout"]);
  });
});

describe("mixSidebarLive", () => {
  it("lists rooms with ungrouped people, pinned people first", () => {
    const mixed = mixSidebarLive(
      [
        {
          id: "piper",
          pinnedAt: "2026-09-01T00:00:00.000Z",
          lastAt: "2026-08-01T00:00:00.000Z",
        },
        { id: "scout", pinnedAt: null, lastAt: "2026-09-02T00:00:00.000Z" },
      ],
      [{ id: "sync", lastAt: "2026-09-03T00:00:00.000Z" }],
    );
    expect(mixed.map((row) => `${row.kind}:${row.item.id}`)).toEqual([
      "bot:piper",
      "room:sync",
      "bot:scout",
    ]);
  });
});

describe("sectionMenuItems", () => {
  it("renames, then confirms delete by name", () => {
    expect(
      sectionMenuItems({ name: "Sales", phase: "actions" }),
    ).toEqual([
      { id: "rename", label: "Rename" },
      { id: "delete", label: "Delete", danger: true },
    ]);
    expect(
      sectionMenuItems({
        name: "Sales",
        phase: "confirm-delete",
      }),
    ).toEqual([
      { id: "delete", label: "Delete Sales", danger: true },
      { id: "cancel-delete", label: "Cancel" },
    ]);
  });
});

describe("roomMenuItems", () => {
  it("confirms delete by name", () => {
    expect(roomMenuItems({ name: "Board", phase: "actions" })).toEqual([
      { id: "delete", label: "Delete", danger: true },
    ]);
    expect(
      roomMenuItems({ name: "Board", phase: "confirm-delete" }),
    ).toEqual([
      { id: "delete", label: "Delete Board", danger: true },
      { id: "cancel-delete", label: "Cancel" },
    ]);
  });
});

