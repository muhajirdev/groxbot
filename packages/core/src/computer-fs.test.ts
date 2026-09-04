import { describe, expect, it } from "vitest";
import { listComputerEntries, readComputerFile } from "./computer.js";
import {
  COMPUTER_SHELL_BACKEND,
  computerAbsolutePath,
  computerRelativePath,
  computerWorkerShell,
  copyThinkWorkspaceToComputer,
  type ComputerFs,
  diskFromComputerFs,
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
    const parts = computerRelativePath(abs).split("/").filter(Boolean);
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
  it("prefixes Think-style relative paths", () => {
    expect(computerAbsolutePath("inbox/a.md")).toBe("/inbox/a.md");
    expect(computerAbsolutePath("/inbox/a.md")).toBe("/inbox/a.md");
    expect(computerAbsolutePath("")).toBe("/");
    expect(computerRelativePath("/inbox/a.md")).toBe("inbox/a.md");
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

  it("returns null for a missing file instead of throwing", async () => {
    const disk = diskFromComputerFs(new MemoryComputerFs());
    await expect(disk.readFile("nope.md")).resolves.toBeNull();
    await expect(disk.stat("nope.md")).resolves.toBeNull();
  });
});

describe("copyThinkWorkspaceToComputer", () => {
  it("copies shell table rows onto the Computer disk", async () => {
    const fs = new MemoryComputerFs();
    const disk = diskFromComputerFs(fs);
    const sql = {
      exec() {
        return [
          {
            path: "/inbox",
            type: "directory",
            content: null,
            content_encoding: "utf8",
          },
          {
            path: "/inbox/note.md",
            type: "file",
            content: "saved",
            content_encoding: "utf8",
          },
        ];
      },
    };
    await expect(copyThinkWorkspaceToComputer({ sql, disk })).resolves.toBe(
      "copied",
    );
    await expect(disk.readFile("inbox/note.md")).resolves.toBe("saved");
  });

  it("skips when the Computer disk already has files", async () => {
    const fs = new MemoryComputerFs();
    const disk = diskFromComputerFs(fs);
    await disk.writeFile("keep.md", "new");
    const sql = {
      exec() {
        return [
          {
            path: "/old.md",
            type: "file",
            content: "old",
            content_encoding: "utf8",
          },
        ];
      },
    };
    await expect(copyThinkWorkspaceToComputer({ sql, disk })).resolves.toBe(
      "already",
    );
    await expect(disk.readFile("old.md")).resolves.toBeNull();
    await expect(disk.readFile("keep.md")).resolves.toBe("new");
  });

  it("treats a missing Think table as empty", async () => {
    const disk = diskFromComputerFs(new MemoryComputerFs());
    const sql = {
      exec() {
        throw new Error("no such table: cf_workspace_default");
      },
    };
    await expect(copyThinkWorkspaceToComputer({ sql, disk })).resolves.toBe(
      "empty",
    );
  });
});

describe("withComputerOfficeTools", () => {
  it("aliases ls onto Think’s list name", () => {
    const ls = { description: "list files" };
    expect(withComputerOfficeTools({ ls, exec: true })).toEqual({
      ls,
      exec: true,
      list: ls,
    });
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
    });
  });
});
