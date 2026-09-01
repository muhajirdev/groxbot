import { describe, expect, it } from "vitest";
import {
  PUBLIC_FETCH_ALLOWLIST,
  isMarkdownName,
  markdownFileName,
  mimeTypeForMarkdownName,
  readMarkdownConversion,
  runToMarkdown,
  type MarkdownDisk,
} from "./markdown.js";

class MemoryDisk implements MarkdownDisk {
  constructor(
    private readonly files: Record<string, string | Uint8Array> = {},
  ) {}

  async readFile(path: string): Promise<string | null> {
    const value = this.files[path];
    if (value == null) return null;
    return typeof value === "string" ? value : new TextDecoder().decode(value);
  }

  async readFileBytes(path: string): Promise<Uint8Array | null> {
    const value = this.files[path];
    if (value == null) return null;
    return typeof value === "string" ? new TextEncoder().encode(value) : value;
  }
}

describe("PUBLIC_FETCH_ALLOWLIST", () => {
  it("covers public http(s) URLs", () => {
    expect(PUBLIC_FETCH_ALLOWLIST).toEqual(["https://**", "http://**"]);
  });
});

describe("markdownFileName", () => {
  it("prefers an explicit name, then the path, then page.html", () => {
    expect(markdownFileName({ name: "docs/a.pdf" })).toBe("a.pdf");
    expect(markdownFileName({ path: "inbox/spec.html" })).toBe("spec.html");
    expect(markdownFileName({ html: "<h1>Hi</h1>" })).toBe("page.html");
  });
});

describe("mimeTypeForMarkdownName", () => {
  it("treats html input as HTML even when the name is generic", () => {
    expect(mimeTypeForMarkdownName("document", "<p>x</p>")).toBe("text/html");
  });

  it("maps common document extensions", () => {
    expect(mimeTypeForMarkdownName("a.pdf")).toBe("application/pdf");
    expect(mimeTypeForMarkdownName("a.html")).toBe("text/html");
    expect(isMarkdownName("notes.md")).toBe(true);
  });
});

describe("readMarkdownConversion", () => {
  it("reads a Workers AI conversion row", () => {
    expect(
      readMarkdownConversion({
        name: "page.html",
        mimetype: "text/html",
        format: "markdown",
        tokens: 12,
        data: "# Hello",
      }),
    ).toEqual({
      ok: true,
      name: "page.html",
      mimeType: "text/html",
      markdown: "# Hello",
      tokens: 12,
    });
  });

  it("surfaces conversion errors", () => {
    expect(
      readMarkdownConversion([{ format: "error", error: "unsupported" }]),
    ).toEqual({ ok: false, message: "unsupported" });
  });
});

describe("runToMarkdown", () => {
  it("converts HTML through the host converter", async () => {
    const result = await runToMarkdown({
      input: { html: "<h1>Hi</h1>" },
      workspace: new MemoryDisk(),
      sanitizePath: (path) => path,
      convert: async (file) => {
        expect(file.name).toBe("page.html");
        expect(file.mimeType).toBe("text/html");
        expect(new TextDecoder().decode(file.bytes)).toBe("<h1>Hi</h1>");
        return { format: "markdown", data: "# Hi", name: file.name };
      },
    });
    expect(result).toMatchObject({ ok: true, markdown: "# Hi" });
  });

  it("returns markdown files as-is", async () => {
    const result = await runToMarkdown({
      input: { path: "notes.md" },
      workspace: new MemoryDisk({ "notes.md": "# Saved" }),
      sanitizePath: (path) => path,
    });
    expect(result).toEqual({
      ok: true,
      name: "notes.md",
      mimeType: "text/markdown",
      markdown: "# Saved",
    });
  });

  it("rejects mixed or empty input", async () => {
    const workspace = new MemoryDisk();
    expect(
      await runToMarkdown({
        input: { html: "<p>x</p>", path: "a.html" },
        workspace,
        sanitizePath: (path) => path,
      }),
    ).toMatchObject({ ok: false, message: /not both/ });
    expect(
      await runToMarkdown({
        input: {},
        workspace,
        sanitizePath: (path) => path,
      }),
    ).toMatchObject({ ok: false, message: /html from fetch_url/ });
    expect(
      await runToMarkdown({
        input: { html: "<p>x</p>" },
        workspace,
        sanitizePath: (path) => path,
      }),
    ).toMatchObject({ ok: false, message: /not available/ });
  });
});
