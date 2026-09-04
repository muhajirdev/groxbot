import { describe, expect, it } from "vitest";
import {
  neighborBotId,
  paletteFilePrefetchPaths,
  paletteSearchKey,
  PALETTE_FILE_LIMIT,
  rankPaletteItems,
  ROSTER_NEXT_HOTKEY,
  ROSTER_PREV_HOTKEY,
  type PaletteApp,
  type PaletteBot,
  type PaletteFile,
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

const voice: PaletteFile = {
  path: "how-we-work/voice.md",
  name: "voice.md",
  title: "Voice",
  description: "How we sound in writing",
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

  it("does not list knowledge files until you type", () => {
    const rows = rankPaletteItems("", [piper], [brief], [standup], [voice]);
    expect(rows.some((row) => row.kind === "file")).toBe(false);
  });

  it("matches knowledge files by name, title, or path", () => {
    expect(
      rankPaletteItems("voice", [piper], [brief], [standup], [voice])[0],
    ).toMatchObject({ kind: "file", key: "file:how-we-work/voice.md" });
    expect(
      rankPaletteItems("how-we-work", [piper], [], [], [voice]).some(
        (row) => row.kind === "file",
      ),
    ).toBe(true);
  });

  it("scopes to files when the query starts with #", () => {
    const rows = rankPaletteItems("#voice", [piper], [brief], [standup], [voice]);
    expect(rows.map((row) => row.key)).toEqual(["file:how-we-work/voice.md"]);
  });

  it("caps knowledge hits so a broad query does not flood the list", () => {
    const files = Array.from({ length: PALETTE_FILE_LIMIT + 8 }, (_, i) => ({
      path: `notes/n${i}.md`,
      name: `n${i}.md`,
      title: `Note ${i}`,
      description: "note",
    }));
    const rows = rankPaletteItems("note", [piper], [], [], files);
    expect(rows.filter((row) => row.kind === "file")).toHaveLength(
      PALETTE_FILE_LIMIT,
    );
  });
});

describe("paletteFilePrefetchPaths", () => {
  it("warms a small hit list so opening contact.md is already cached", () => {
    const contact: PaletteFile = {
      path: "people/contact.md",
      name: "contact.md",
      title: "Contact",
      description: "",
    };
    const rows = rankPaletteItems("contact.md", [piper], [], [], [contact]);
    expect(paletteFilePrefetchPaths(rows, 0)).toEqual(["people/contact.md"]);
  });

  it("skips binaries and only warms the focused neighborhood on a flood", () => {
    const files = Array.from({ length: PALETTE_FILE_LIMIT }, (_, i) => ({
      path: i === 2 ? "shots/hero.png" : `notes/n${i}.md`,
      name: i === 2 ? "hero.png" : `n${i}.md`,
      title: i === 2 ? "Hero" : `Note ${i}`,
      description: "note",
    }));
    const rows = rankPaletteItems("note", [piper], [], [], files);
    const filesOnly = rows.filter((row) => row.kind === "file");
    const active = filesOnly.findIndex(
      (row) => row.kind === "file" && row.file.path === "notes/n4.md",
    );
    expect(paletteFilePrefetchPaths(filesOnly, active)).toEqual([
      "notes/n4.md",
      "notes/n5.md",
      "notes/n3.md",
    ]);
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

describe("roster cycle hotkeys", () => {
  it("uses option arrows, not bare up/down", () => {
    expect(ROSTER_NEXT_HOTKEY).toBe("Alt+ArrowDown");
    expect(ROSTER_PREV_HOTKEY).toBe("Alt+ArrowUp");
    expect(ROSTER_NEXT_HOTKEY.startsWith("Arrow")).toBe(false);
    expect(ROSTER_PREV_HOTKEY.startsWith("Arrow")).toBe(false);
  });
});

describe("paletteSearchKey", () => {
  it("closes on Escape instead of treating it as blur", () => {
    expect(paletteSearchKey("Escape")).toBe("close");
    expect(paletteSearchKey("Enter")).toBe("run");
    expect(paletteSearchKey("ArrowDown")).toBe("down");
    expect(paletteSearchKey("a")).toBeNull();
  });
});
