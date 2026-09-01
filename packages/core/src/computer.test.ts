import { describe, expect, it } from "vitest";
import {
  ComputerPathError,
  MAX_COMPUTER_ENTRIES,
  MAX_COMPUTER_READ_CHARS,
  MAX_COMPUTER_WRITE_BYTES,
  decodeComputerBytes,
  listComputerEntries,
  readComputerFile,
  sanitizeAttachmentName,
  sanitizeComputerPath,
  writeInboxFile,
  type ComputerDisk,
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
    expect(() => sanitizeComputerPath("../etc/passwd")).toThrow(ComputerPathError);
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
});
