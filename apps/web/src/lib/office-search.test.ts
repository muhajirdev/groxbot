import { describe, expect, it } from "vitest";
import {
  deskApp,
  deskClosed,
  deskComputer,
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

  it("drops unknown panes", () => {
    expect(officeSearch({ pane: "nope" })).toEqual({});
    expect(officeSearch(undefined)).toEqual({});
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
