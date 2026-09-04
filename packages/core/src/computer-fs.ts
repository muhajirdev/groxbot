/** Adapt @cloudflare/computer `workspace.fs` to Think’s WorkspaceLike / ComputerDisk. */

import {
  type ComputerDisk,
  listComputerEntries,
  THINK_WORKSPACE_TABLE,
} from "./computer.js";

export const COMPUTER_DISK_FLAG = "computer.disk";
export const COMPUTER_DISK_DOFS = "dofs";

export type ComputerFsDirent = {
  name: string;
  isDirectory?: boolean;
  isFile?: boolean;
};

export type ComputerFsStat = {
  isDirectory?: boolean;
  isFile?: boolean;
  size?: number;
  mtime?: number;
};

export type ComputerFsFind = {
  path: string;
  type?: "file" | "dir" | string;
};

/** Subset of `@cloudflare/computer` `workspace.fs` the office disk needs. */
export type ComputerFs = {
  readFile(path: string, encoding?: "utf8"): Promise<unknown>;
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
  mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>;
  rm(
    path: string,
    opts?: { recursive?: boolean; force?: boolean },
  ): Promise<void>;
  readdir(path: string): Promise<ComputerFsDirent[]>;
  stat(path: string): Promise<ComputerFsStat>;
  find?(
    directory: string,
    pattern?: string,
  ): Promise<ComputerFsFind[]>;
};

export type ComputerWorkspaceDisk = {
  readFile(path: string): Promise<string | null>;
  readFileBytes(path: string): Promise<Uint8Array | null>;
  glob(pattern: string): Promise<ThinkFileInfo[]>;
  readDir(
    dir: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<ThinkFileInfo[]>;
  writeFile(path: string, content: string): Promise<void>;
  writeFileBytes(path: string, content: Uint8Array): Promise<void>;
  mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>;
  rm(
    path: string,
    opts?: { recursive?: boolean; force?: boolean },
  ): Promise<void>;
  stat(path: string): Promise<ThinkFileInfo | null>;
};

type ThinkFileInfo = {
  path: string;
  name: string;
  type: "file" | "directory";
  mimeType: string;
  size: number;
  createdAt: number;
  updatedAt: number;
};

type SqlExec = {
  exec(query: string): unknown;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Think/office paths are relative; Computer VFS paths are absolute. */
export function computerAbsolutePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "." || trimmed === "/") return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function computerRelativePath(path: string): string {
  return path.replace(/^\/+/u, "");
}

export function diskFromComputerFs(fs: ComputerFs): ComputerWorkspaceDisk {
  return {
    async readFile(path) {
      try {
        const text = await fs.readFile(computerAbsolutePath(path), "utf8");
        return typeof text === "string" ? text : null;
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    async readFileBytes(path) {
      try {
        return await bytesFromFs(fs, computerAbsolutePath(path));
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    async writeFile(path, content) {
      const abs = computerAbsolutePath(path);
      await ensureParent(fs, abs);
      await fs.writeFile(abs, content);
    },
    async writeFileBytes(path, content) {
      const abs = computerAbsolutePath(path);
      await ensureParent(fs, abs);
      await fs.writeFile(abs, content);
    },
    async mkdir(path, opts) {
      const abs = computerAbsolutePath(path);
      if (abs === "/") return;
      await fs.mkdir(abs, { recursive: opts?.recursive ?? true });
    },
    async rm(path, opts) {
      const abs = computerAbsolutePath(path);
      if (abs === "/") return;
      try {
        await fs.rm(abs, {
          recursive: opts?.recursive ?? false,
          force: opts?.force ?? false,
        });
      } catch (error) {
        if (opts?.force && isMissing(error)) return;
        throw error;
      }
    },
    async readDir(dir, opts) {
      let entries: ComputerFsDirent[] = [];
      try {
        entries = await fs.readdir(computerAbsolutePath(dir));
      } catch (error) {
        if (isMissing(error)) return [];
        throw error;
      }
      const offset = opts && "offset" in opts ? (opts.offset ?? 0) : 0;
      const limit = opts?.limit ?? entries.length;
      const parent = computerRelativePath(computerAbsolutePath(dir));
      return entries.slice(offset, offset + limit).map((entry) => {
        const name = entry.name;
        const path = parent ? `${parent}/${name}` : name;
        return toInfo({
          path,
          name,
          directory: Boolean(entry.isDirectory) && !entry.isFile,
          size: 0,
        });
      });
    },
    async glob(pattern) {
      const abs = computerAbsolutePath(pattern);
      const { directory, relativePattern } = splitGlob(abs);
      if (!fs.find) {
        return matchByWalk(this, pattern);
      }
      try {
        const found = await fs.find(directory, relativePattern);
        return found.map((row) => {
          const path = computerRelativePath(row.path);
          return toInfo({
            path,
            name: path.split("/").at(-1) ?? path,
            directory: row.type === "dir",
            size: 0,
          });
        });
      } catch (error) {
        if (isMissing(error)) return [];
        throw error;
      }
    },
    async stat(path) {
      try {
        const info = await fs.stat(computerAbsolutePath(path));
        const relative = computerRelativePath(computerAbsolutePath(path));
        return toInfo({
          path: relative,
          name: relative.split("/").at(-1) ?? relative,
          directory: Boolean(info.isDirectory) && !info.isFile,
          size: typeof info.size === "number" ? info.size : 0,
          mtime: info.mtime,
        });
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
  };
}

export async function copyThinkWorkspaceToComputer(opts: {
  sql: SqlExec;
  disk: ComputerDisk;
}): Promise<"copied" | "empty" | "already"> {
  const listed = await listComputerEntries(opts.disk);
  if (listed.entries.some((row) => row.kind === "file")) return "already";
  const rows = thinkWorkspaceRows(opts.sql);
  if (rows.length === 0) return "empty";
  const ordered = [...rows].sort(
    (a, b) => a.path.split("/").length - b.path.split("/").length,
  );
  for (const row of ordered) {
    const path = computerRelativePath(row.path);
    if (!path) continue;
    if (row.type === "directory") {
      await opts.disk.mkdir?.(path, { recursive: true });
      continue;
    }
    if (row.type !== "file") continue;
    const bytes = thinkRowBytes(row);
    if (opts.disk.writeFileBytes) {
      await opts.disk.writeFileBytes(path, bytes);
    } else if (opts.disk.writeFile) {
      await opts.disk.writeFile(path, textDecoder.decode(bytes));
    }
  }
  return "copied";
}

function thinkWorkspaceRows(sql: SqlExec): ThinkRow[] {
  try {
    const cursor = sql.exec(
      `SELECT path, type, content, content_encoding FROM ${THINK_WORKSPACE_TABLE} WHERE path != '/'`,
    );
    return asRows(cursor)
      .map(asThinkRow)
      .filter((row): row is ThinkRow => row !== null);
  } catch {
    return [];
  }
}

type ThinkRow = {
  path: string;
  type: string;
  content: string | null;
  content_encoding: string | null;
};

function asThinkRow(row: Record<string, unknown>): ThinkRow | null {
  const path = typeof row.path === "string" ? row.path : "";
  if (!path) return null;
  return {
    path,
    type: typeof row.type === "string" ? row.type : "file",
    content: typeof row.content === "string" ? row.content : null,
    content_encoding:
      typeof row.content_encoding === "string" ? row.content_encoding : null,
  };
}

function thinkRowBytes(row: ThinkRow): Uint8Array {
  const content = row.content ?? "";
  if (row.content_encoding === "base64" && content) {
    return decodeBase64(content);
  }
  return textEncoder.encode(content);
}

function asRows(cursor: unknown): Record<string, unknown>[] {
  if (!cursor) return [];
  if (
    typeof cursor === "object" &&
    "toArray" in cursor &&
    typeof cursor.toArray === "function"
  ) {
    const rows = cursor.toArray() as unknown;
    return Array.isArray(rows)
      ? rows.filter(isRecord)
      : [];
  }
  if (typeof cursor === "object" && Symbol.iterator in cursor) {
    return [...(cursor as Iterable<unknown>)].filter(isRecord);
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function decodeBase64(content: string): Uint8Array {
  const buffer = (
    globalThis as {
      Buffer?: { from(data: string, enc: string): Uint8Array };
    }
  ).Buffer;
  if (buffer) return new Uint8Array(buffer.from(content, "base64"));
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function bytesFromFs(fs: ComputerFs, path: string): Promise<Uint8Array> {
  const raw = await fs.readFile(path);
  if (typeof raw === "string") return textEncoder.encode(raw);
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (isReadableStream(raw)) return drainBytes(raw);
  return textEncoder.encode("");
}

function isReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
  return Boolean(
    value &&
      typeof value === "object" &&
      "getReader" in value &&
      typeof value.getReader === "function",
  );
}

async function drainBytes(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      parts.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

async function ensureParent(fs: ComputerFs, absPath: string): Promise<void> {
  const parent = dirname(absPath);
  if (!parent || parent === "/") return;
  try {
    await fs.mkdir(parent, { recursive: true });
  } catch (error) {
    if (!isMissing(error) && !isExists(error)) throw error;
  }
}

function splitGlob(pattern: string): {
  directory: string;
  relativePattern: string;
} {
  const wildcard = firstWildcard(pattern);
  if (wildcard === -1) {
    return { directory: dirname(pattern), relativePattern: basename(pattern) };
  }
  const slash = pattern.lastIndexOf("/", wildcard);
  return {
    directory: slash <= 0 ? "/" : pattern.slice(0, slash),
    relativePattern: pattern.slice(slash + 1),
  };
}

function firstWildcard(pattern: string): number {
  const star = pattern.indexOf("*");
  const question = pattern.indexOf("?");
  if (star === -1) return question;
  if (question === -1) return star;
  return Math.min(star, question);
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  if (index <= 0) return "/";
  return path.slice(0, index);
}

function basename(path: string): string {
  const trimmed = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;
  const index = trimmed.lastIndexOf("/");
  return index === -1 ? trimmed : trimmed.slice(index + 1);
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

async function matchByWalk(
  disk: ComputerWorkspaceDisk,
  pattern: string,
): Promise<ThinkFileInfo[]> {
  const re = globRe(computerRelativePath(computerAbsolutePath(pattern)));
  const listed = await listComputerEntries(disk);
  return listed.entries
    .filter((row) => re.test(row.path))
    .map((row) =>
      toInfo({
        path: row.path,
        name: row.path.split("/").at(-1) ?? row.path,
        directory: row.kind === "dir",
        size: row.size ?? 0,
      }),
    );
}

function toInfo(input: {
  path: string;
  name: string;
  directory: boolean;
  size: number;
  mtime?: number;
}): ThinkFileInfo {
  const mtime = input.mtime ?? 0;
  return {
    path: input.path,
    name: input.name,
    type: input.directory ? "directory" : "file",
    mimeType: input.directory
      ? "inode/directory"
      : "application/octet-stream",
    size: input.size,
    createdAt: mtime,
    updatedAt: mtime,
  };
}

function isMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  if (code === "ENOENT") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /ENOENT|no such file|must be absolute/i.test(message);
}

function isExists(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  return code === "EEXIST" || /EEXIST|already exists/i.test(String(error));
}
