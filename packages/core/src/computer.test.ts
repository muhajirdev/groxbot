import { describe, expect, it } from "vitest";
import {
  type ComputerDisk,
  ComputerPathError,
  computerPathLooksLikeFile,
  decodeComputerBytes,
  downloadComputerFile,
  encodeComputerBytes,
  healThinkWorkspaceFileRows,
  hostedChatMessages,
  listComputerEntries,
  MAX_COMPUTER_ENTRIES,
  MAX_COMPUTER_READ_CHARS,
  MAX_COMPUTER_WRITE_BYTES,
  mediaTypeForComputerPath,
  patchComputerWorkspace,
  readComputerFile,
  sanitizeAttachmentName,
  sanitizeComputerPath,
  writeInboxFile,
} from "./computer.js";

class MemoryDisk implements ComputerDisk {
  readonly files = new Map<string, string>();

  async readFile(path: string): Promise<string | null> {
    return this.files.get(norm(path)) ?? null;
  }

  async glob(pattern: string): Promise<string[]> {
    const re = globRe(pattern);
    return [...this.files.keys()].filter((path) => re.test(path)).sort();
  }

  async readDir(path: string): Promise<{ path: string; type: string }[]> {
    const prefix = path && path !== "." ? `${norm(path)}/` : "";
    const names = new Map<string, string>();
    for (const file of this.files.keys()) {
      if (prefix && !file.startsWith(prefix)) continue;
      const rest = prefix ? file.slice(prefix.length) : file;
      if (!rest) continue;
      const cut = rest.indexOf("/");
      if (cut === -1) names.set(rest, "file");
      else names.set(rest.slice(0, cut), "directory");
    }
    return [...names.entries()].map(([name, type]) => ({ path: name, type }));
  }

  async stat(path: string) {
    const content = this.files.get(norm(path));
    if (content != null) return { type: "file", size: content.length };
    const prefix = `${norm(path)}/`;
    for (const file of this.files.keys()) {
      if (file.startsWith(prefix)) return { type: "directory", size: 0 };
    }
    return null;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(norm(path), content);
  }

  async mkdir(): Promise<void> {
    // Paths are implicit in this map.
  }
}

function norm(path: string): string {
  return path.replace(/^\.?\//u, "").replace(/\/+$/u, "");
}

function globRe(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `^${escaped.replace(/\*\*/g, ":::").replace(/\*/g, "[^/]+").replace(/:::/g, ".*")}$`,
  );
}

describe("sanitizeComputerPath", () => {
  it("treats root aliases as empty", () => {
    expect(sanitizeComputerPath(undefined)).toBe("");
    expect(sanitizeComputerPath("/")).toBe("");
    expect(sanitizeComputerPath(".")).toBe("");
  });

  it("rejects escapes", () => {
    expect(() => sanitizeComputerPath("../etc/passwd")).toThrow(
      ComputerPathError,
    );
    expect(() => sanitizeComputerPath("skills/../../secret")).toThrow(
      ComputerPathError,
    );
  });
});

describe("listComputerEntries", () => {
  it("returns files and parent folders", async () => {
    const disk = new MemoryDisk();
    disk.files.set("memory.md", "notes");
    disk.files.set("skills/digest/SKILL.md", "do it");
    const listed = await listComputerEntries(disk);
    expect(listed.truncated).toBe(false);
    expect(listed.entries.map((row) => `${row.kind}:${row.path}`)).toEqual([
      "file:memory.md",
      "dir:skills",
      "dir:skills/digest",
      "file:skills/digest/SKILL.md",
    ]);
  });

  it("does not loop when readDir repeats the folder", async () => {
    const disk: ComputerDisk = {
      readFile: async () => null,
      readDir: async () => [{ path: ".", type: "directory" }],
    };
    await expect(listComputerEntries(disk)).resolves.toEqual({
      entries: [],
      truncated: false,
    });
  });

  it("finds top-level files from glob alone", async () => {
    const disk: ComputerDisk = {
      readFile: async () => null,
      glob: async (pattern) => {
        const files = ["memory.md", "skills/digest/SKILL.md"];
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(
          `^${escaped.replace(/\*\*/g, ":::").replace(/\*/g, "[^/]+").replace(/:::/g, ".*")}$`,
        );
        return files.filter((path) => re.test(path));
      },
    };
    const listed = await listComputerEntries(disk);
    expect(listed.entries.map((row) => row.path)).toContain("memory.md");
  });

  it("lists a subdirectory", async () => {
    const disk = new MemoryDisk();
    disk.files.set("memory.md", "notes");
    disk.files.set("skills/digest/SKILL.md", "do it");
    const listed = await listComputerEntries(disk, "skills");
    expect(listed.entries.map((row) => row.path)).toEqual([
      "skills",
      "skills/digest",
      "skills/digest/SKILL.md",
    ]);
  });

  it("caps a huge tree", async () => {
    const disk = new MemoryDisk();
    for (let i = 0; i < MAX_COMPUTER_ENTRIES + 20; i++) {
      disk.files.set(`notes/n${String(i).padStart(3, "0")}.md`, "x");
    }
    const listed = await listComputerEntries(disk);
    expect(listed.truncated).toBe(true);
    expect(listed.entries.length).toBeLessThanOrEqual(MAX_COMPUTER_ENTRIES);
  });

  it("lists a directory row with file bytes as a file", async () => {
    const disk: ComputerDisk = {
      readFile: async () => null,
      readDir: async (path) => {
        if (path && path !== ".") return [];
        return [
          { path: "essay-car.md", type: "directory", size: 1200 },
          { path: "inbox", type: "directory", size: 0 },
        ];
      },
    };
    const listed = await listComputerEntries(disk);
    expect(listed.entries.map((row) => `${row.kind}:${row.path}`)).toEqual([
      "file:essay-car.md",
      "dir:inbox",
    ]);
  });
});

describe("readComputerFile", () => {
  it("reads text and marks binary", async () => {
    const disk = new MemoryDisk();
    disk.files.set("memory.md", "office notes");
    disk.files.set("shot.png", "\0png");
    await expect(readComputerFile(disk, "memory.md")).resolves.toEqual({
      path: "memory.md",
      content: "office notes",
      truncated: false,
      encoding: "text",
    });
    await expect(readComputerFile(disk, "shot.png")).resolves.toMatchObject({
      path: "shot.png",
      encoding: "binary",
      content: "",
    });
  });

  it("truncates long files", async () => {
    const disk = new MemoryDisk();
    disk.files.set("big.md", "a".repeat(MAX_COMPUTER_READ_CHARS + 8));
    const file = await readComputerFile(disk, "big.md");
    expect(file.truncated).toBe(true);
    expect(file.content.length).toBe(MAX_COMPUTER_READ_CHARS);
  });
});

describe("downloadComputerFile", () => {
  it("returns text as utf-8 base64", async () => {
    const disk = new MemoryDisk();
    disk.files.set("inbox/notes.md", "office notes");
    const file = await downloadComputerFile(disk, "inbox/notes.md");
    expect(file).toEqual({
      path: "inbox/notes.md",
      filename: "notes.md",
      content: encodeComputerBytes(new TextEncoder().encode("office notes")),
      mediaType: "text/markdown",
    });
  });

  it("returns binary bytes from readFileBytes", async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2]);
    const disk: ComputerDisk = {
      readFile: async () => null,
      readFileBytes: async (path) => (path === "shot.png" ? png : null),
    };
    const file = await downloadComputerFile(disk, "shot.png");
    expect(file.filename).toBe("shot.png");
    expect(file.mediaType).toBe("image/png");
    expect(decodeComputerBytes(file.content)).toEqual(png);
  });

  it("falls back to latin1 for binary strings", async () => {
    const disk = new MemoryDisk();
    disk.files.set("shot.png", "\0png");
    const file = await downloadComputerFile(disk, "shot.png");
    expect(decodeComputerBytes(file.content)).toEqual(
      Uint8Array.from([0, 112, 110, 103]),
    );
  });

  it("rejects oversized files", async () => {
    const disk: ComputerDisk = {
      readFile: async () => null,
      readFileBytes: async () => new Uint8Array(MAX_COMPUTER_WRITE_BYTES + 1),
    };
    await expect(downloadComputerFile(disk, "huge.bin")).rejects.toThrow(
      /too large/,
    );
  });
});

describe("mediaTypeForComputerPath", () => {
  it("maps common extensions", () => {
    expect(mediaTypeForComputerPath("inbox/shot.png")).toBe("image/png");
    expect(mediaTypeForComputerPath("notes.md")).toBe("text/markdown");
    expect(mediaTypeForComputerPath("mystery")).toBe(
      "application/octet-stream",
    );
  });
});

describe("writeInboxFile", () => {
  it("sanitizes names and rejects escapes", () => {
    expect(sanitizeAttachmentName("../secret.md")).toBe("secret.md");
    expect(sanitizeAttachmentName("")).toBe("file");
    expect(sanitizeAttachmentName("notes.md")).toBe("notes.md");
  });

  it("writes under inbox and uniquifies collisions", async () => {
    const disk = new MemoryDisk();
    const first = await writeInboxFile(
      disk,
      "notes.md",
      new TextEncoder().encode("one"),
    );
    const second = await writeInboxFile(
      disk,
      "notes.md",
      new TextEncoder().encode("two"),
    );
    expect(first).toEqual({ path: "inbox/notes.md", size: 3 });
    expect(second.path).toBe("inbox/notes-1.md");
    expect(disk.files.get("inbox/notes.md")).toBe("one");
    expect(disk.files.get("inbox/notes-1.md")).toBe("two");
  });

  it("rejects oversized files", async () => {
    const disk = new MemoryDisk();
    await expect(
      writeInboxFile(
        disk,
        "big.md",
        new Uint8Array(MAX_COMPUTER_WRITE_BYTES + 1),
      ),
    ).rejects.toThrow(/too large/);
  });

  it("decodes data URLs", () => {
    const bytes = decodeComputerBytes("data:text/plain;base64,aGk=");
    expect(new TextDecoder().decode(bytes)).toBe("hi");
  });

  it("round-trips raw bytes", () => {
    const bytes = Uint8Array.from([0, 1, 255, 10]);
    expect(decodeComputerBytes(encodeComputerBytes(bytes))).toEqual(bytes);
  });
});

describe("hostedChatMessages", () => {
  it("drops file parts so only the inbox path text remains", () => {
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "read this" },
          {
            type: "file",
            mediaType: "application/pdf",
            filename: "a.pdf",
            data: "inbox/a.pdf",
          },
          {
            type: "file",
            mediaType: "image/png",
            data: "data:image/png;base64,aa",
          },
        ],
      },
    ];
    expect(hostedChatMessages(messages)).toEqual([
      {
        role: "user",
        content: [{ type: "text", text: "read this" }],
      },
    ]);
  });

  it("drops UI file parts whose url is a workspace path", () => {
    const messages = [
      {
        role: "user",
        parts: [
          { type: "text", text: "On this computer: inbox/a.pdf" },
          {
            type: "file",
            mediaType: "application/pdf",
            filename: "a.pdf",
            url: "inbox/a.pdf",
          },
        ],
      },
    ];
    expect(hostedChatMessages(messages)).toEqual([
      {
        role: "user",
        parts: [{ type: "text", text: "On this computer: inbox/a.pdf" }],
      },
    ]);
  });

  it("prefixes the speaker so the model can tell humans apart", () => {
    const messages = [
      {
        role: "user",
        metadata: { user: { userId: "usr_1", name: "Alex" } },
        parts: [{ type: "text", text: "ship the brief" }],
      },
    ];
    expect(hostedChatMessages(messages)).toEqual([
      {
        role: "user",
        metadata: { user: { userId: "usr_1", name: "Alex" } },
        parts: [{ type: "text", text: "Alex: ship the brief" }],
      },
    ]);
  });
});

/** Mimics Cloudflare Workspace: writeFile updates content but not directory type. */
class ThinkWriteBugDisk implements ComputerDisk {
  readonly rows = new Map<
    string,
    { type: "file" | "directory"; content: string }
  >();

  async readFile(path: string): Promise<string | null> {
    const row = this.rows.get(norm(path));
    if (!row) return null;
    if (row.type === "directory") {
      throw new Error(`EISDIR: ${path} is a directory`);
    }
    return row.content;
  }

  async stat(path: string) {
    const row = this.rows.get(norm(path));
    if (!row) return null;
    return { type: row.type, size: row.content.length };
  }

  async readDir() {
    return [...this.rows.entries()].map(([path, row]) => ({
      path,
      type: row.type,
      size: row.content.length,
    }));
  }

  async mkdir(path: string) {
    this.rows.set(norm(path), { type: "directory", content: "" });
  }

  async writeFile(path: string, content: string) {
    const key = norm(path);
    const existing = this.rows.get(key);
    if (existing) {
      existing.content = content;
      return;
    }
    this.rows.set(key, { type: "file", content });
  }

  async rm(path: string) {
    this.rows.delete(norm(path));
  }
}

describe("computerPathLooksLikeFile", () => {
  it("recognizes markdown and nested files", () => {
    expect(computerPathLooksLikeFile("essay-car.md")).toBe(true);
    expect(computerPathLooksLikeFile("/inbox/notes.txt")).toBe(true);
    expect(computerPathLooksLikeFile("inbox")).toBe(false);
    expect(computerPathLooksLikeFile("skills")).toBe(false);
  });
});

describe("patchComputerWorkspace", () => {
  it("does not mkdir a relative file path, then writes a real file", async () => {
    const disk = new ThinkWriteBugDisk();
    patchComputerWorkspace(disk);
    await disk.mkdir?.("essay-car.md", { recursive: true });
    await disk.writeFile?.("essay-car.md", "# Cars");
    expect(disk.rows.get("essay-car.md")).toEqual({
      type: "file",
      content: "# Cars",
    });
    await expect(readComputerFile(disk, "essay-car.md")).resolves.toMatchObject(
      {
        content: "# Cars",
        encoding: "text",
      },
    );
    const listed = await listComputerEntries(disk);
    expect(listed.entries).toEqual([
      { path: "essay-car.md", kind: "file", size: 6 },
    ]);
  });

  it("replaces a leftover directory so writeFile is readable", async () => {
    const disk = new ThinkWriteBugDisk();
    await disk.mkdir("essay-car.md");
    await disk.writeFile("essay-car.md", "# Cars");
    await expect(readComputerFile(disk, "essay-car.md")).rejects.toThrow(
      "File not found.",
    );
    patchComputerWorkspace(disk);
    await disk.writeFile?.("essay-car.md", "# Cars");
    await expect(readComputerFile(disk, "essay-car.md")).resolves.toMatchObject(
      {
        content: "# Cars",
      },
    );
  });
});

describe("healThinkWorkspaceFileRows", () => {
  it("updates directory rows that already hold bytes", () => {
    const ran: string[] = [];
    healThinkWorkspaceFileRows({
      exec(query) {
        ran.push(query);
      },
    });
    expect(ran[0]).toMatch(/SET type = 'file'/);
    expect(ran[0]).toMatch(/type = 'directory' AND size > 0/);
  });

  it("swallows a missing table", () => {
    expect(() =>
      healThinkWorkspaceFileRows({
        exec() {
          throw new Error("no such table: cf_workspace_default");
        },
      }),
    ).not.toThrow();
  });
});
