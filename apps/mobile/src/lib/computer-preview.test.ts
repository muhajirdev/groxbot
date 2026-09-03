import { describe, expect, it } from "vitest";
import {
  computerFileKind,
  computerPreviewKind,
  computerPreviewSource,
} from "./computer-preview";

describe("computerFileKind", () => {
  it("classifies explorer icons", () => {
    expect(computerFileKind("inbox/shot.png")).toBe("image");
    expect(computerFileKind("notes.md")).toBe("md");
    expect(computerFileKind("page.html")).toBe("html");
    expect(computerFileKind("invoice.pdf")).toBe("pdf");
    expect(computerFileKind("archive.zip")).toBe("file");
  });
});

describe("computerPreviewKind", () => {
  it("previews html, pdf, images, and text", () => {
    expect(computerPreviewKind("inbox/page.html")).toBe("html");
    expect(computerPreviewKind("invoice.pdf")).toBe("pdf");
    expect(computerPreviewKind("shot.png")).toBe("image");
    expect(computerPreviewKind("skills/digest/SKILL.md")).toBe("text");
    expect(computerPreviewKind("archive.zip")).toBe("none");
  });

  it("lets media type win over a mystery name", () => {
    expect(computerPreviewKind("mystery", "image/png")).toBe("image");
    expect(computerPreviewKind("mystery", "application/pdf")).toBe("pdf");
  });
});

describe("computerPreviewSource", () => {
  it("reads text and html, downloads pdf and images", () => {
    expect(computerPreviewSource("text")).toBe("read");
    expect(computerPreviewSource("pdf")).toBe("download");
    expect(computerPreviewSource("image")).toBe("download");
  });
});
