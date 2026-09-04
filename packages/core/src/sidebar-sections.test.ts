import { describe, expect, it } from "vitest";
import {
  compareSidebarBots,
  groupSidebarBots,
  mixSidebarLive,
  nextSectionPosition,
  roomSidebarFaces,
  SectionError,
  sectionName,
} from "./sidebar-roster.js";

describe("sectionName", () => {
  it("trims and rejects an empty name", () => {
    expect(sectionName("  Sales  ")).toBe("Sales");
    expect(() => sectionName("   ")).toThrow(SectionError);
    expect(() => sectionName("   ")).toThrow(/Name this section/);
  });
});

describe("nextSectionPosition", () => {
  it("starts at 0 and appends after the max", () => {
    expect(nextSectionPosition([])).toBe(0);
    expect(nextSectionPosition([0, 2])).toBe(3);
  });
});

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

describe("groupSidebarBots", () => {
  const sales = { id: "sales", name: "Sales", position: 0 };
  const ops = { id: "ops", name: "Ops", position: 1 };
  const piper = {
    id: "piper",
    sectionId: null,
    pinnedAt: null,
    lastAt: "2026-09-02T00:00:00.000Z",
  };
  const scout = {
    id: "scout",
    sectionId: "sales",
    pinnedAt: "2026-09-01T00:00:00.000Z",
    lastAt: "2026-08-01T00:00:00.000Z",
  };
  const lookout = {
    id: "lookout",
    sectionId: "sales",
    pinnedAt: null,
    lastAt: "2026-09-03T00:00:00.000Z",
  };
  const chief = {
    id: "chief",
    sectionId: "gone",
    pinnedAt: null,
    lastAt: "2026-09-04T00:00:00.000Z",
  };

  it("keeps ungrouped people on top, then sections by position", () => {
    const grouped = groupSidebarBots(
      [lookout, piper, scout],
      [ops, sales],
    );
    expect(grouped.ungrouped.map((bot) => bot.id)).toEqual(["piper"]);
    expect(grouped.sections.map((row) => row.section.id)).toEqual([
      "sales",
      "ops",
    ]);
    expect(grouped.sections[0]?.bots.map((bot) => bot.id)).toEqual([
      "scout",
      "lookout",
    ]);
    expect(grouped.sections[1]?.bots).toEqual([]);
  });

  it("treats a missing section as ungrouped", () => {
    const grouped = groupSidebarBots([chief, piper], [sales]);
    expect(grouped.ungrouped.map((bot) => bot.id)).toEqual(["chief", "piper"]);
    expect(grouped.sections[0]?.bots).toEqual([]);
  });
});

describe("mixSidebarLive", () => {
  it("interleaves rooms with ungrouped people by recency", () => {
    const piper = { id: "piper", pinnedAt: null, lastAt: "2026-09-02T00:00:00.000Z" };
    const room = { id: "sync", lastAt: "2026-09-03T00:00:00.000Z" };
    const mixed = mixSidebarLive([piper], [room]);
    expect(mixed.map((row) => row.kind + ":" + row.item.id)).toEqual([
      "room:sync",
      "bot:piper",
    ]);
  });

  it("keeps pinned people above rooms", () => {
    const piper = {
      id: "piper",
      pinnedAt: "2026-09-01T00:00:00.000Z",
      lastAt: "2026-08-01T00:00:00.000Z",
    };
    const room = { id: "sync", lastAt: "2026-09-03T00:00:00.000Z" };
    const mixed = mixSidebarLive([piper], [room]);
    expect(mixed.map((row) => row.kind)).toEqual(["bot", "room"]);
  });
});

describe("roomSidebarFaces", () => {
  const piper = { id: "piper", archivedAt: null };
  const scout = { id: "scout", archivedAt: null };
  const lookout = { id: "lookout", archivedAt: null };
  const old = { id: "old", archivedAt: "2026-08-01T00:00:00.000Z" };

  it("skips archived members when someone is live", () => {
    expect(roomSidebarFaces([old, piper, scout]).map((row) => row.id)).toEqual([
      "piper",
      "scout",
    ]);
  });

  it("falls back to archived faces when the room is empty of live people", () => {
    expect(roomSidebarFaces([old]).map((row) => row.id)).toEqual(["old"]);
  });

  it("caps the stack at three", () => {
    const chief = { id: "chief", archivedAt: null };
    expect(
      roomSidebarFaces([piper, scout, lookout, chief]).map((row) => row.id),
    ).toEqual(["piper", "scout", "lookout"]);
  });
});
