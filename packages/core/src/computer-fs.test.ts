import { describe, expect, it } from "vitest";
import { listComputerEntries, readComputerFile } from "./computer.js";
import {
  COMPUTER_SHELL_BACKEND,
  COMPUTER_SHELL_CAPTURE_BYTES,
  COMPUTER_VFS_ROOT,
  type ComputerFs,
  binaryComputerReadRefusal,
  computerImageFromRead,
  computerReadConverts,
  computerReadShowsImage,
  computerAbsolutePath,
  computerRelativePath,
  computerVfsPaths,
  computerWorkerShell,
  diskFromComputerFs,
  ensureComputerHome,
  extractOfficeImagesFromPayload,
  officeImageToolResult,
  officeImagesToolResult,
  officeShellCommandRefusal,
  rewriteComputerToolArgs,
  withComputerOfficeTools,
} from "./computer-fs.js";

class MemoryComputerFs implements ComputerFs {
  readonly files = new Map<string, string | Uint8Array>();
  readonly dirs = new Set<string>(["/"]);

  async readFile(path: string, encoding?: "utf8"): Promise<string | Uint8Array> {
    const abs = computerAbsolutePath(path);
    if (this.dirs.has(abs) && !this.files.has(abs)) {
      throw Object.assign(new Error("EISDIR"), { code: "EISDIR" });
    }
    const value = this.files.get(abs);
    if (value === undefined) {
      throw Object.assign(new Error(`ENOENT: ${abs}`), { code: "ENOENT" });
    }
    if (encoding === "utf8") {
      return typeof value === "string"
        ? value
        : new TextDecoder().decode(value);
    }
    return typeof value === "string" ? new TextEncoder().encode(value) : value;
  }

  async writeFile(path: string, content: string | Uint8Array): Promise<void> {
    const abs = computerAbsolutePath(path);
    this.dirs.delete(abs);
    this.files.set(abs, content);
    this.addParents(abs);
  }

  async mkdir(path: string): Promise<void> {
    const abs = computerAbsolutePath(path);
    if (abs === "/") return;
    if (this.files.has(abs)) {
      throw Object.assign(new Error("EEXIST"), { code: "EEXIST" });
    }
    this.dirs.add(abs);
    this.addParents(abs);
  }

  async rm(path: string, opts?: { recursive?: boolean; force?: boolean }) {
    const abs = computerAbsolutePath(path);
    const existed = this.files.delete(abs) || this.dirs.delete(abs);
    if (opts?.recursive) {
      for (const file of [...this.files.keys()]) {
        if (file.startsWith(`${abs}/`)) this.files.delete(file);
      }
      for (const dir of [...this.dirs]) {
        if (dir.startsWith(`${abs}/`)) this.dirs.delete(dir);
      }
    }
    if (!existed && !opts?.force) {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    }
  }

  async readdir(path: string) {
    const abs = computerAbsolutePath(path);
    if (abs !== "/" && !this.dirs.has(abs) && !this.files.has(abs)) {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    }
    const prefix = abs === "/" ? "/" : `${abs}/`;
    const names = new Map<string, "file" | "directory">();
    for (const dir of this.dirs) {
      if (dir === abs || !dir.startsWith(prefix)) continue;
      const rest = dir.slice(prefix.length);
      const name = rest.split("/")[0];
      if (name) names.set(name, "directory");
    }
    for (const file of this.files.keys()) {
      if (!file.startsWith(prefix)) continue;
      const rest = file.slice(prefix.length);
      const name = rest.split("/")[0];
      if (name && !rest.includes("/")) names.set(name, "file");
      else if (name && !names.has(name)) names.set(name, "directory");
    }
    return [...names.entries()].map(([name, kind]) => ({
      name,
      isDirectory: kind === "directory",
      isFile: kind === "file",
    }));
  }

  async stat(path: string) {
    const abs = computerAbsolutePath(path);
    const file = this.files.get(abs);
    if (file !== undefined) {
      const size =
        typeof file === "string"
          ? new TextEncoder().encode(file).byteLength
          : file.byteLength;
      return { isDirectory: false, isFile: true, size };
    }
    if (this.dirs.has(abs)) {
      return { isDirectory: true, isFile: false, size: 0 };
    }
    throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
  }

  async find(directory: string, pattern = "*") {
    const prefix = computerAbsolutePath(directory);
    const re = globRe(
      prefix === "/" ? pattern : `${computerRelativePath(prefix)}/${pattern}`,
    );
    const hits: { path: string; type: "file" | "dir" }[] = [];
    for (const dir of this.dirs) {
      if (dir !== "/" && re.test(computerRelativePath(dir))) {
        hits.push({ path: dir, type: "dir" });
      }
    }
    for (const file of this.files.keys()) {
      if (re.test(computerRelativePath(file))) {
        hits.push({ path: file, type: "file" });
      }
    }
    return hits;
  }

  private addParents(abs: string) {
    const parts = abs.split("/").filter(Boolean);
    let cursor = "";
    for (const part of parts.slice(0, -1)) {
      cursor = `${cursor}/${part}`;
      this.dirs.add(cursor);
    }
  }
}

function globRe(pattern: string): RegExp {
  const body = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${body}$`);
}

describe("computerAbsolutePath", () => {
  it("prefixes relative office paths", () => {
    expect(computerAbsolutePath("inbox/a.md")).toBe("/inbox/a.md");
    expect(computerAbsolutePath("/inbox/a.md")).toBe("/inbox/a.md");
    expect(computerAbsolutePath("")).toBe("/");
    expect(computerRelativePath("/inbox/a.md")).toBe("inbox/a.md");
  });

  it("also looks under /workspace for Computer-tool writes", () => {
    expect(computerVfsPaths("notes.md")).toEqual([
      "/notes.md",
      "/workspace/notes.md",
    ]);
    expect(computerVfsPaths("/workspace/notes.md")).toEqual([
      "/workspace/notes.md",
    ]);
    expect(computerVfsPaths("workspace/notes.md")).toEqual([
      "/workspace/notes.md",
    ]);
    expect(computerVfsPaths("inbox/a.md")).toEqual([
      "/inbox/a.md",
      "/workspace/inbox/a.md",
    ]);
  });
});

describe("rewriteComputerToolArgs", () => {
  it("makes relative inbox paths absolute and unwraps /workspace/inbox", () => {
    expect(
      rewriteComputerToolArgs("read", { path: "inbox/a.pdf" }),
    ).toEqual({ path: "/inbox/a.pdf" });
    expect(
      rewriteComputerToolArgs("read", {
        path: "/workspace/inbox/a.pdf",
      }),
    ).toEqual({ path: "/inbox/a.pdf" });
    expect(
      rewriteComputerToolArgs("write", { path: "invoice.html" }),
    ).toEqual({ path: "/workspace/invoice.html" });
  });

  it("defaults find and list to the VFS root", () => {
    expect(rewriteComputerToolArgs("find", { pattern: "**/*.pdf" })).toEqual({
      pattern: "**/*.pdf",
      path: "/",
    });
    expect(rewriteComputerToolArgs("list", {})).toEqual({ path: "/" });
    expect(rewriteComputerToolArgs("grep", { query: "x" })).toEqual({
      query: "x",
      path: "/",
    });
  });
});

describe("computerReadConverts", () => {
  it("converts PDFs and Office docs, not raster images", () => {
    expect(computerReadConverts("inbox/scope.pdf")).toBe(true);
    expect(computerReadConverts("/inbox/photo.PNG")).toBe(false);
    expect(computerReadConverts("draft.docx")).toBe(true);
    expect(computerReadConverts("notes.md")).toBe(false);
    expect(computerReadConverts("invoice.html")).toBe(false);
    expect(computerReadConverts("archive.zip")).toBe(false);
  });
});

describe("computerReadShowsImage", () => {
  it("shows PNG, JPEG, GIF, and WebP", () => {
    expect(computerReadShowsImage("/workspace/invoice.png")).toBe(true);
    expect(computerReadShowsImage("inbox/photo.JPEG")).toBe(true);
    expect(computerReadShowsImage("inbox/scope.pdf")).toBe(false);
    expect(computerReadShowsImage("notes.md")).toBe(false);
  });
});

describe("computerImageFromRead", () => {
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  it("attaches a PNG dump as an image part", () => {
    const result = computerImageFromRead(
      {
        kind: "file",
        path: "/workspace/invoice.png",
        mediaType: "image/png",
        data: png,
      },
      "/workspace/invoice.png",
    );
    expect(result).toMatchObject({
      details: { path: "workspace/invoice.png", mediaType: "image/png" },
    });
    expect(result && "content" in result && result.content[1]).toEqual({
      type: "image",
      data: png,
      mimeType: "image/png",
    });
  });

  it("strips a data URL prefix", () => {
    const result = computerImageFromRead(
      {
        path: "shot.png",
        mediaType: "image/png",
        data: `data:image/png;base64,${png}`,
      },
      "shot.png",
    );
    expect(result && "content" in result && result.content[1]).toMatchObject({
      type: "image",
      data: png,
    });
  });

  it("does not treat a PDF dump as an image", () => {
    expect(
      computerImageFromRead(
        {
          path: "/inbox/scope.pdf",
          mediaType: "application/pdf",
          data: "JVBERi0xLjQK",
        },
        "/inbox/scope.pdf",
      ),
    ).toBeNull();
  });
});

describe("officeImageToolResult", () => {
  it("does not put the image bytes in details", () => {
    const row = officeImageToolResult({
      path: "/workspace/a.png",
      data: "abc",
      mimeType: "image/png",
    });
    expect(row.details).toEqual({
      path: "workspace/a.png",
      mediaType: "image/png",
      bytes: expect.any(Number),
    });
    expect(JSON.stringify(row.details)).not.toContain("abc");
  });
});

describe("extractOfficeImagesFromPayload", () => {
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const jpeg = `/9j/${"A".repeat(80)}`;

  it("pulls SineMart { mimeType, byteLength, imageBase64 } and omits the bytes", () => {
    const extracted = extractOfficeImagesFromPayload({
      mimeType: "image/jpeg",
      byteLength: 12_345,
      imageBase64: jpeg,
    });
    expect(extracted.images).toEqual([{ data: jpeg, mimeType: "image/jpeg" }]);
    expect(extracted.stripped).toEqual({
      mimeType: "image/jpeg",
      byteLength: 12_345,
      imageBase64: expect.stringMatching(/^\[image attached, \d+ bytes\]$/),
    });
    expect(JSON.stringify(extracted.stripped)).not.toContain(jpeg);
  });

  it("pulls nested Code Mode calls[].result once when result repeats the dump", () => {
    const extracted = extractOfficeImagesFromPayload({
      status: "completed",
      executionId: "exec_1",
      result: {
        mimeType: "image/jpeg",
        byteLength: jpeg.length,
        imageBase64: jpeg,
      },
      calls: [
        {
          seq: 0,
          connector: "sinemart",
          method: "view_invoice_image",
          result: {
            mimeType: "image/jpeg",
            byteLength: jpeg.length,
            imageBase64: jpeg,
          },
        },
      ],
    });
    expect(extracted.images).toEqual([{ data: jpeg, mimeType: "image/jpeg" }]);
    expect(JSON.stringify(extracted.stripped)).not.toContain(jpeg);
  });

  it("pulls MCP image content parts", () => {
    const extracted = extractOfficeImagesFromPayload({
      content: [{ type: "image", data: png, mimeType: "image/png" }],
    });
    expect(extracted.images).toEqual([{ data: png, mimeType: "image/png" }]);
    expect(extracted.stripped).toEqual({
      content: [
        {
          type: "image",
          data: expect.stringMatching(/^\[image attached, \d+ bytes\]$/),
          mimeType: "image/png",
        },
      ],
    });
  });

  it("pulls snake_case mime_type / image_base64", () => {
    const extracted = extractOfficeImagesFromPayload({
      mime_type: "image/jpg",
      image_base64: jpeg,
    });
    expect(extracted.images).toEqual([{ data: jpeg, mimeType: "image/jpeg" }]);
  });

  it("strips a data URL prefix on imageBase64", () => {
    const extracted = extractOfficeImagesFromPayload({
      mimeType: "image/png",
      imageBase64: `data:image/png;base64,${png}`,
    });
    expect(extracted.images).toEqual([{ data: png, mimeType: "image/png" }]);
  });

  it("leaves a non-image code result alone", () => {
    const value = { ok: true, invoiceId: "inv_1" };
    expect(extractOfficeImagesFromPayload(value)).toEqual({
      images: [],
      stripped: value,
    });
  });
});

describe("officeImagesToolResult", () => {
  it("uses officeImageToolResult so Pi gets an image part", () => {
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const row = officeImagesToolResult(
      [{ data: png, mimeType: "image/png" }],
      "Invoice image attached.",
    );
    expect(row).toEqual(
      officeImageToolResult({
        data: png,
        mimeType: "image/png",
        text: "Invoice image attached.",
      }),
    );
  });
});

describe("binaryComputerReadRefusal", () => {
  it("refuses a base64 PDF dump when conversion is not wired", () => {
    expect(
      binaryComputerReadRefusal({
        kind: "file",
        path: "/inbox/scope.pdf",
        mediaType: "application/pdf",
        data: "JVBERi0xLjQK",
      }),
    ).toEqual({
      ok: false,
      message: expect.stringMatching(/to_markdown\(\{ path: "inbox\/scope.pdf" \}\)/),
    });
  });

  it("lets text files through", () => {
    expect(
      binaryComputerReadRefusal({
        path: "/workspace/notes.md",
        mediaType: "text/markdown",
        data: "# hi",
      }),
    ).toBeNull();
  });
});

describe("diskFromComputerFs", () => {
  it("reads and writes relative office paths onto an absolute VFS", async () => {
    const fs = new MemoryComputerFs();
    const disk = diskFromComputerFs(fs);
    await disk.writeFile("inbox/hello.md", "# hi");
    await expect(disk.readFile("inbox/hello.md")).resolves.toBe("# hi");
    await expect(fs.readFile("/inbox/hello.md", "utf8")).resolves.toBe("# hi");
    await expect(readComputerFile(disk, "inbox/hello.md")).resolves.toMatchObject(
      {
        path: "inbox/hello.md",
        content: "# hi",
        encoding: "text",
      },
    );
  });

  it("lists and stats without leading slashes", async () => {
    const fs = new MemoryComputerFs();
    const disk = diskFromComputerFs(fs);
    await disk.writeFile("skills/demo/SKILL.md", "---\nname: demo\n---\n");
    const listed = await listComputerEntries(disk);
    expect(listed.entries.map((row) => row.path)).toEqual([
      "skills",
      "skills/demo",
      "skills/demo/SKILL.md",
    ]);
    await expect(disk.stat("skills")).resolves.toMatchObject({
      path: "skills",
      type: "directory",
    });
    const hits = await disk.glob("skills/*/SKILL.md");
    expect(hits.map((row) => row.path)).toEqual(["skills/demo/SKILL.md"]);
  });

  it("glob does not crash when find returns undefined", async () => {
    const fs = new MemoryComputerFs();
    await fs.writeFile("/inbox/a.pdf", "x");
    fs.find = async () => undefined as unknown as [];
    const disk = diskFromComputerFs(fs);
    await expect(disk.glob("**/*.pdf")).resolves.toEqual([
      expect.objectContaining({ path: "inbox/a.pdf" }),
    ]);
  });

  it("returns null for a missing file instead of throwing", async () => {
    const disk = diskFromComputerFs(new MemoryComputerFs());
    await expect(disk.readFile("nope.md")).resolves.toBeNull();
    await expect(disk.stat("nope.md")).resolves.toBeNull();
  });
});

describe("withComputerOfficeTools", () => {
  it("renames ls to list and exec to shell, and does not keep both", () => {
    const ls = { description: "list files" };
    const exec = { description: "old exec" };
    expect(withComputerOfficeTools({ ls, exec })).toEqual({
      list: ls,
      shell: {
        description: expect.stringMatching(/just-bash on this computer/),
      },
    });
    expect(withComputerOfficeTools({ ls, exec })).not.toHaveProperty("exec");
    expect(withComputerOfficeTools({ ls, exec })).not.toHaveProperty("ls");
  });

  it("rewrites the read description to mention offset and PDF conversion", () => {
    const read = { description: "Read a workspace file.", execute: () => {} };
    expect(withComputerOfficeTools({ read }).read).toMatchObject({
      description: expect.stringMatching(/offset/),
    });
    expect(withComputerOfficeTools({ read }).read).toMatchObject({
      description: expect.stringMatching(/convert to markdown/),
    });
  });
});

describe("ensureComputerHome", () => {
  it("mkdirs /workspace", async () => {
    const fs = new MemoryComputerFs();
    await ensureComputerHome(fs);
    expect(fs.dirs.has(COMPUTER_VFS_ROOT)).toBe(true);
    await expect(fs.readdir(COMPUTER_VFS_ROOT)).resolves.toEqual([]);
  });
});

describe("desk vs VFS write paths", () => {
  it("opens notes.md after a Computer write to /workspace/notes.md", async () => {
    const fs = new MemoryComputerFs();
    await ensureComputerHome(fs);
    await fs.writeFile("/workspace/notes.md", "# Notes");
    const disk = diskFromComputerFs(fs);
    await expect(readComputerFile(disk, "notes.md")).resolves.toMatchObject({
      path: "notes.md",
      content: "# Notes",
    });
    await expect(
      readComputerFile(disk, "/workspace/notes.md"),
    ).resolves.toMatchObject({
      content: "# Notes",
    });
    const listed = await listComputerEntries(disk);
    expect(listed.entries.map((row) => row.path)).toContain("workspace/notes.md");
  });
});

describe("computerWorkerShell", () => {
  it("names Worker shell as the only exec backend", () => {
    expect(computerWorkerShell()).toEqual({
      defaultBackend: COMPUTER_SHELL_BACKEND,
      backends: {
        [COMPUTER_SHELL_BACKEND]: {
          description: expect.stringMatching(/just-bash/i),
        },
      },
      maxBytes: COMPUTER_SHELL_CAPTURE_BYTES,
    });
  });
});

describe("officeShellCommandRefusal", () => {
  it("points pdfinfo and pdftotext at read()", () => {
    expect(
      officeShellCommandRefusal(
        "date -Iseconds && pdfinfo inbox/agreement-sinemart-2026.pdf",
      ),
    ).toMatch(/read\(\)/);
    expect(
      officeShellCommandRefusal(
        "pdftotext -layout inbox/agreement.pdf - | sed -n '1,180p'",
      ),
    ).toMatch(/pdftotext/);
  });

  it("rejects GNU date -I without running the shell", () => {
    expect(officeShellCommandRefusal("date -Iseconds && ls")).toMatch(
      /POSIX/,
    );
    expect(officeShellCommandRefusal("date '+%Y-%m-%d'")).toBeNull();
  });

  it("lets ordinary just-bash through", () => {
    expect(officeShellCommandRefusal("ls inbox && mkdir -p workspace/out")).toBeNull();
    expect(officeShellCommandRefusal("sed -n '1,20p' notes.md")).toBeNull();
  });
});
