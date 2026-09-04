import { describe, expect, it } from "vitest";
import {
  closeLibrary,
  closePeek,
  deskApp,
  deskClosed,
  deskComputer,
  deskLibrary,
  deskPeek,
  deskSettings,
  officeSearch,
  toggleDesk,
} from "./office-search";

describe("officeSearch", () => {
  it("accepts settings and computer", () => {
    expect(officeSearch({ pane: "settings" })).toEqual({ pane: "settings" });
    expect(officeSearch({ pane: "computer" })).toEqual({ pane: "computer" });
  });

  it("requires an app id for the app pane", () => {
    expect(officeSearch({ pane: "app" })).toEqual({});
    expect(officeSearch({ pane: "app", app: "  " })).toEqual({});
    expect(officeSearch({ pane: "app", app: "app-1" })).toEqual({
      pane: "app",
      app: "app-1",
    });
  });

  it("keeps a focused teammate on room desks", () => {
    expect(officeSearch({ bot: "steve" })).toEqual({ bot: "steve" });
    expect(officeSearch({ pane: "computer", bot: "steve" })).toEqual({
      pane: "computer",
      bot: "steve",
    });
  });

  it("reuses the same object for closed / settings / computer", () => {
    expect(officeSearch(undefined)).toBe(deskClosed());
    expect(officeSearch({ pane: "settings" })).toBe(deskSettings());
    expect(officeSearch({ pane: "computer" })).toBe(deskComputer());
  });
});

describe("desk helpers", () => {
  it("toggles settings and computer closed", () => {
    expect(toggleDesk(deskSettings(), "settings")).toEqual(deskClosed());
    expect(toggleDesk(deskClosed(), "computer")).toEqual(deskComputer());
  });

  it("opens an app by id", () => {
    expect(deskApp("doc-1")).toEqual({ pane: "app", app: "doc-1" });
  });
});

describe("knowledge desk", () => {
  it("opens a peek at an office path", () => {
    expect(
      officeSearch({ pane: "knowledge", knowledge: "how-we-work/voice.md" }),
    ).toEqual({
      pane: "knowledge",
      knowledge: "how-we-work/voice.md",
    });
    expect(deskPeek("how-we-work/voice.md")).toEqual({
      pane: "knowledge",
      knowledge: "how-we-work/voice.md",
    });
  });

  it("rejects traversal in the knowledge path", () => {
    expect(
      officeSearch({ pane: "knowledge", knowledge: "../secret.md" }),
    ).toEqual({
      pane: "knowledge",
    });
    expect(deskPeek("../secret.md")).toEqual({ pane: "knowledge" });
  });

  it("opens the library without a bot pane", () => {
    expect(officeSearch({ library: true })).toEqual({ library: true });
    expect(
      officeSearch({ library: "true", knowledge: "skills/foo/SKILL.md" }),
    ).toEqual({
      library: true,
      knowledge: "skills/foo/SKILL.md",
    });
  });

  it("keeps the previous pane under the library so Back can restore it", () => {
    expect(deskLibrary({ pane: "computer" }, "company/resources.md")).toEqual({
      pane: "computer",
      knowledge: "company/resources.md",
      library: true,
    });
    expect(
      deskLibrary({ pane: "knowledge", knowledge: "a.md" }, "a.md"),
    ).toEqual({
      pane: "knowledge",
      knowledge: "a.md",
      library: true,
    });
  });

  it("Back from the library restores the pane", () => {
    expect(
      closeLibrary({
        pane: "computer",
        knowledge: "note.md",
        library: true,
      }),
    ).toEqual({ pane: "computer", knowledge: "note.md" });
    expect(closeLibrary({ library: true })).toEqual({});
  });

  it("closing a peek returns to chat", () => {
    expect(closePeek({ pane: "knowledge", knowledge: "a.md" })).toEqual({});
    expect(
      closePeek({ pane: "knowledge", knowledge: "a.md", library: true }),
    ).toEqual({ knowledge: "a.md", library: true });
  });
});
