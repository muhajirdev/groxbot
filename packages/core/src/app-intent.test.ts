import { describe, expect, it } from "vitest";
import { parseAppIntent } from "./app-intent.js";

describe("parseAppIntent", () => {
  it("detects make me slides", () => {
    expect(parseAppIntent("make me slides about Q3")).toEqual({
      templateId: "slides",
      title: "Q3",
    });
  });

  it("detects a spreadsheet", () => {
    expect(parseAppIntent("create a spreadsheet of costs")).toEqual({
      templateId: "sheets",
      title: "costs",
    });
  });

  it("detects a doc", () => {
    expect(parseAppIntent("draft a document called Hiring plan")).toEqual({
      templateId: "docs",
      title: "Hiring plan",
    });
  });

  it("ignores ordinary chat", () => {
    expect(parseAppIntent("what is in the repo")).toBeNull();
    expect(parseAppIntent("make a sandwich")).toBeNull();
  });
});
