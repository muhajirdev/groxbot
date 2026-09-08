import { describe, expect, it } from "vitest";
import {
  isMarkdownName,
  markdownFileName,
  mimeTypeForMarkdownName,
  persistToMarkdownPage,
  presentToMarkdown,
  readMarkdownConversion,
  runToMarkdown,
  runToMarkdownPaged,
  toMarkdownSpillPath,
  type MarkdownDisk,
  type MarkdownWriteDisk,
} from "./markdown.js";
import { PUBLIC_FETCH_ALLOWLIST } from "./public-fetch.js";

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

class WritableMemoryDisk implements MarkdownWriteDisk {
  constructor(private readonly files: Map<string, string> = new Map()) {}

  async readFile(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async mkdir(): Promise<void> {}

  get(path: string): string | undefined {
    return this.files.get(path);
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
        input: { html: "", path: "notes.md" },
        workspace: new MemoryDisk({ "notes.md": "# Saved" }),
        sanitizePath: (path) => path,
      }),
    ).toMatchObject({ ok: true, markdown: "# Saved" });
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

describe("presentToMarkdown", () => {
  it("returns a ~19k conversion in one page", () => {
    const markdown = "n".repeat(19_662);
    const spill = toMarkdownSpillPath("scope-sinemart-finance-ops.pdf");
    const text = presentToMarkdown(
      {
        ok: true,
        name: "scope-sinemart-finance-ops.pdf",
        mimeType: "application/pdf",
        markdown,
      },
      { spillPath: spill },
    );
    expect(text).toBe(markdown);
    expect(text).not.toMatch(/Use offset=/);
    expect(text).not.toMatch(/^Result truncated/);
  });

  it("pages a conversion over the 50KB read window and points at the spilled file", () => {
    const markdown = Array.from(
      { length: 2_100 },
      (_, i) => `line-${i + 1} ${"x".repeat(80)}`,
    ).join("\n");
    const spill = toMarkdownSpillPath("scope-sinemart-finance-ops.pdf");
    const text = presentToMarkdown(
      {
        ok: true,
        name: "scope-sinemart-finance-ops.pdf",
        mimeType: "application/pdf",
        markdown,
      },
      { spillPath: spill },
    );
    expect(spill).toBe("/workspace/.tool-output/scope-sinemart-finance-ops.md");
    expect(text).toContain(spill);
    expect(text).toMatch(/Use offset=\d+ to continue/);
    expect(text).toContain("do not convert again");
    expect(text.length).toBeLessThan(markdown.length);
    expect(text).not.toMatch(/^Result truncated/);
  });

  it("continues from offset", () => {
    const markdown = Array.from({ length: 10 }, (_, i) => `L${i + 1}`).join("\n");
    const text = presentToMarkdown(
      {
        ok: true,
        name: "a.pdf",
        mimeType: "application/pdf",
        markdown,
      },
      { offset: 8 },
    );
    expect(text).toContain("L8");
    expect(text).toContain("L10");
    expect(text).not.toContain("L1\n");
  });
});

describe("persistToMarkdownPage", () => {
  it("writes the full markdown and returns it when it fits in one page", async () => {
    const files = new Map<string, string>();
    const markdown = "n".repeat(12_000);
    const page = await persistToMarkdownPage(
      {
        ok: true,
        name: "scope.pdf",
        mimeType: "application/pdf",
        markdown,
      },
      {
        workspace: {
          readFile: async () => null,
          writeFile: async (path, content) => {
            files.set(path, content);
          },
          mkdir: async () => {},
        },
      },
    );
    expect(page).toBe(markdown);
    expect(files.get("/workspace/.tool-output/scope.md")).toBe(markdown);
  });
});

describe("runToMarkdownPaged", () => {
  it("converts once and reuses the spill on offset and a repeat path", async () => {
    const disk = new WritableMemoryDisk(
      new Map([["inbox/scope.pdf", "%PDF-fake"]]),
    );
    let converts = 0;
    const convert = async () => {
      converts += 1;
      return {
        format: "markdown",
        data: "hello from pdf",
        name: "scope.pdf",
      };
    };
    const first = await runToMarkdownPaged({
      input: { path: "inbox/scope.pdf" },
      workspace: disk,
      convert,
      sanitizePath: (path) => path,
    });
    expect(first).toBe("hello from pdf");
    expect(disk.get("/workspace/.tool-output/scope.md")).toBe("hello from pdf");
    expect(converts).toBe(1);

    const again = await runToMarkdownPaged({
      input: { path: "inbox/scope.pdf" },
      workspace: disk,
      convert,
      sanitizePath: (path) => path,
    });
    expect(again).toBe("hello from pdf");
    expect(converts).toBe(1);

    const paged = await runToMarkdownPaged({
      input: { path: "inbox/scope.pdf", offset: 1 },
      workspace: disk,
      convert,
      sanitizePath: (path) => path,
    });
    expect(paged).toBe("hello from pdf");
    expect(converts).toBe(1);
  });
});
