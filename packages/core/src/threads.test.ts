import { describe, expect, it } from "vitest";
import { previewFromBlocks } from "./threads.js";

describe("previewFromBlocks", () => {
  it("joins text blocks and ignores meta", () => {
    expect(
      previewFromBlocks([
        { kind: "text", text: "  Sign in  " },
        { kind: "meta", text: "tool" },
        { kind: "text", text: "to LinkedIn" },
      ]),
    ).toBe("Sign in to LinkedIn");
  });

  it("returns empty for junk", () => {
    expect(previewFromBlocks(null)).toBe("");
    expect(previewFromBlocks([{ kind: "meta", text: "x" }])).toBe("");
  });

  it("surfaces an app title", () => {
    expect(
      previewFromBlocks([
        { kind: "text", text: "Here you go" },
        { kind: "app", appId: "a1", templateId: "slides", title: "Q3" },
      ]),
    ).toBe("Here you go Q3");
  });
});
