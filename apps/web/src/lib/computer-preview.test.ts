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
    expect(computerFileKind("mark.svg")).toBe("svg");
    expect(computerFileKind("archive.zip")).toBe("file");
  });
});

describe("computerPreviewKind", () => {
  it("previews html, pdf, images, and text", () => {
    expect(computerPreviewKind("inbox/page.html")).toBe("html");
    expect(computerPreviewKind("invoice.pdf")).toBe("pdf");
    expect(computerPreviewKind("shot.png")).toBe("image");
    expect(computerPreviewKind("mark.svg")).toBe("image");
    expect(computerPreviewKind("skills/digest/SKILL.md")).toBe("text");
    expect(computerPreviewKind("package.json")).toBe("text");
    expect(computerPreviewKind("src/bot.ts")).toBe("text");
    expect(computerPreviewKind("Dockerfile")).toBe("text");
    expect(computerPreviewKind("archive.zip")).toBe("none");
    expect(computerPreviewKind("")).toBe("none");
  });

  it("lets media type win over a mystery name", () => {
    expect(computerPreviewKind("mystery", "image/png")).toBe("image");
    expect(computerPreviewKind("mystery", "application/pdf")).toBe("pdf");
    expect(computerPreviewKind("mystery", "application/json")).toBe("text");
  });
});

describe("computerPreviewSource", () => {
  it("reads text and html, downloads pdf and images", () => {
    expect(computerPreviewSource("text")).toBe("read");
    expect(computerPreviewSource("html")).toBe("read");
    expect(computerPreviewSource("pdf")).toBe("download");
    expect(computerPreviewSource("image")).toBe("download");
    expect(computerPreviewSource("none")).toBe("none");
  });
});
