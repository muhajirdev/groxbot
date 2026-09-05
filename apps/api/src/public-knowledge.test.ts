import { describe, expect, it } from "vitest";
import { contentDispositionForPublicFile } from "./public-knowledge.js";

describe("contentDispositionForPublicFile", () => {
  it("inlines raster images", () => {
    expect(contentDispositionForPublicFile("image/png", "shot.png")).toBe(
      'inline; filename="shot.png"',
    );
    expect(contentDispositionForPublicFile("image/jpeg", "shot.jpg")).toBe(
      'inline; filename="shot.jpg"',
    );
  });

  it("never inlines HTML or SVG", () => {
    expect(contentDispositionForPublicFile("text/html", "note.html")).toBe(
      'attachment; filename="note.html"',
    );
    expect(
      contentDispositionForPublicFile("image/svg+xml", "mark.svg"),
    ).toBe('attachment; filename="mark.svg"');
  });

  it("downloads markdown and other files", () => {
    expect(
      contentDispositionForPublicFile("text/markdown", "voice.md"),
    ).toBe('attachment; filename="voice.md"');
  });
});
