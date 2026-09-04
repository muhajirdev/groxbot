import { describe, expect, it } from "vitest";
import {
  neighborBotId,
  rankPaletteItems,
  type PaletteApp,
  type PaletteBot,
  type PaletteRoom,
} from "./command-palette";

const piper: PaletteBot = {
  id: "bot-1",
  name: "Piper",
  title: "Office manager",
  lastPreview: "Booked the room",
  archivedAt: null,
  avatarColor: "#e45c9a",
  avatarShape: "circle",
};

const archived: PaletteBot = {
  id: "bot-2",
  name: "Old Bot",
  title: "",
  lastPreview: "",
  archivedAt: "2026-08-01T00:00:00.000Z",
  avatarColor: "#5b7cff",
  avatarShape: "circle",
};

const brief: PaletteApp = {
  id: "app-1",
  title: "Q3 brief",
  templateId: "docs",
};

const standup: PaletteRoom = {
  id: "room-1",
  name: "Standup",
  lastPreview: "See you at 9",
  memberNames: "Piper Nova",
};

describe("rankPaletteItems", () => {
  it("lists live teammates, rooms, apps, then commands when the query is empty", () => {
    const rows = rankPaletteItems("", [piper, archived], [brief], [standup]);
    expect(rows.map((row) => row.key)).toEqual([
      "bot:bot-1",
      "room:room-1",
      "app:app-1",
      "action:hire",
      "action:room",
      "action:section",
      "action:settings",
      "action:computer",
      "action:plugins",
      "action:knowledge",
      "action:skills",
      "action:workspace",
    ]);
  });

  it("matches a teammate by name and hides unrelated commands", () => {
    const rows = rankPaletteItems("pip", [piper, archived], [brief]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "bot", key: "bot:bot-1" });
  });

  it("surfaces archived teammates only when they match", () => {
    const empty = rankPaletteItems("", [archived], []);
    expect(empty.some((row) => row.kind === "bot")).toBe(false);
    const hit = rankPaletteItems("old", [archived], []);
    expect(hit[0]).toMatchObject({ kind: "bot", key: "bot:bot-2" });
  });

  it("matches apps by title or kind", () => {
    expect(
      rankPaletteItems("brief", [piper], [brief]).map((row) => row.key),
    ).toEqual(["app:app-1"]);
    expect(
      rankPaletteItems("doc", [piper], [brief]).some(
        (row) => row.kind === "app",
      ),
    ).toBe(true);
  });

  it("matches commands by keyword", () => {
    const rows = rankPaletteItems("hire", [piper], []);
    expect(rows[0]).toMatchObject({ kind: "action", key: "action:hire" });
  });

  it("matches rooms by name or member", () => {
    expect(
      rankPaletteItems("stand", [piper], [brief], [standup]).map(
        (row) => row.key,
      ),
    ).toEqual(["room:room-1"]);
    expect(
      rankPaletteItems("nova", [piper], [], [standup]).some(
        (row) => row.kind === "room",
      ),
    ).toBe(true);
  });

  it("matches new create commands and skills", () => {
    expect(rankPaletteItems("new room", [piper], [])[0]).toMatchObject({
      kind: "action",
      key: "action:room",
    });
    expect(rankPaletteItems("section", [piper], [])[0]).toMatchObject({
      kind: "action",
      key: "action:section",
    });
    expect(rankPaletteItems("skills", [piper], [])[0]).toMatchObject({
      kind: "action",
      key: "action:skills",
    });
  });
});

describe("neighborBotId", () => {
  it("wraps around the roster", () => {
    expect(neighborBotId(["a", "b", "c"], "c", 1)).toBe("a");
    expect(neighborBotId(["a", "b", "c"], "a", -1)).toBe("c");
  });

  it("starts at an end when the current id is missing", () => {
    expect(neighborBotId(["a", "b"], "gone", 1)).toBe("a");
    expect(neighborBotId(["a", "b"], undefined, -1)).toBe("b");
  });
});
