/** This bot’s Think workspace. Not a Postgres catalog. */

import {
  COMPUTER_INBOX_DIR,
  MAX_COMPUTER_WRITE_BYTES,
  type ComputerEntry,
  type ComputerFile,
  type ComputerList,
} from "@groxbot/contracts";

export {
  COMPUTER_INBOX_DIR,
  MAX_COMPUTER_ATTACHMENTS,
  MAX_COMPUTER_WRITE_BYTES,
} from "@groxbot/contracts";

export const MAX_COMPUTER_ENTRIES = 200;
export const MAX_COMPUTER_READ_CHARS = 64_000;
export const MAX_COMPUTER_PATH = 240;
export const MAX_COMPUTER_DEPTH = 12;

const TEXT_EXTENSIONS = new Set([
  ".bash",
  ".css",
  ".csv",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".py",
  ".sh",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

export class ComputerPathError extends Error {
  constructor(message = "That path is not on this computer.") {
    super(message);
    this.name = "ComputerPathError";
  }
}

export class ComputerFileError extends Error {
  constructor(message = "File not found.") {
    super(message);
    this.name = "ComputerFileError";
  }
}

export class ComputerWriteError extends Error {
  constructor(message = "Could not save that file on this computer.") {
    super(message);
    this.name = "ComputerWriteError";
  }
}

export type ComputerDisk = {
  readFile(path: string): Promise<string | null>;
  glob?(pattern: string): Promise<unknown>;
  readDir?(path: string, opts?: { limit?: number }): Promise<unknown>;
  stat?(
    path: string,
  ): Promise<{ type?: string; size?: number } | null>;
  writeFile?(path: string, content: string): Promise<void>;
  writeFileBytes?(path: string, content: Uint8Array): Promise<void>;
  mkdir?(path: string, opts?: { recursive?: boolean }): Promise<void>;
};

export function sanitizeComputerPath(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "/" || trimmed === ".") return "";
  const normalized = trimmed.replaceAll("\\", "/").replace(/^\/+/u, "");
  if (!normalized || normalized === ".") return "";
  const parts: string[] = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part === ".." || part.includes("\0")) {
      throw new ComputerPathError();
    }
    parts.push(part);
  }
  if (parts.length > MAX_COMPUTER_DEPTH) throw new ComputerPathError();
  const path = parts.join("/");
  if (path.length > MAX_COMPUTER_PATH) throw new ComputerPathError();
  return path;
}

export async function listComputerEntries(
  disk: ComputerDisk,
  rawPath?: string,
): Promise<ComputerList> {
  const path = sanitizeComputerPath(rawPath);
  const rows = await collectEntries(disk, path);
  const byPath = new Map<string, ComputerEntry>();
  let truncated = false;
  for (const row of rows) {
    if (!row.path || byPath.has(row.path)) continue;
    if (path && row.path !== path && !row.path.startsWith(`${path}/`)) continue;
    byPath.set(row.path, row);
    addParentDirs(byPath, row.path);
    if (byPath.size >= MAX_COMPUTER_ENTRIES) {
      truncated = true;
      break;
    }
  }
  const entries = [...byPath.values()].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  return {
    entries: entries.slice(0, MAX_COMPUTER_ENTRIES),
    truncated,
  };
}

export async function readComputerFile(
  disk: ComputerDisk,
  rawPath: string,
): Promise<ComputerFile> {
  const path = sanitizeComputerPath(rawPath);
  if (!path) throw new ComputerPathError("Pick a file on this computer.");
  let content: string | null;
  try {
    content = await disk.readFile(path);
  } catch {
    throw new ComputerFileError();
  }
  if (content == null) throw new ComputerFileError();
  if (!isTextFile(path, content)) {
    return { path, content: "", truncated: false, encoding: "binary" };
  }
  const truncated = content.length > MAX_COMPUTER_READ_CHARS;
  return {
    path,
    content: truncated ? content.slice(0, MAX_COMPUTER_READ_CHARS) : content,
    truncated,
    encoding: "text",
  };
}

export function sanitizeAttachmentName(filename: string): string {
  const base = filename.replaceAll("\\", "/").split("/").pop() ?? "";
  const cleaned = base
    .replace(/[^\w.\- ()[\]]+/gu, "_")
    .replace(/^\.+/u, "")
    .trim();
  return cleaned.slice(0, 80) || "file";
}

export function decodeComputerBytes(raw: string): Uint8Array {
  const payload = raw.replace(/^data:[^;]*;base64,/iu, "").replace(/\s/g, "");
  if (!payload) return new Uint8Array();
  try {
    const buffer = (
      globalThis as { Buffer?: { from(data: string, enc: string): Uint8Array } }
    ).Buffer;
    if (buffer) return Uint8Array.from(buffer.from(payload, "base64"));
  } catch {
    // Fall through to atob.
  }
  let binary: string;
  try {
    binary = atob(payload);
  } catch {
    throw new ComputerWriteError("That file could not be decoded.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function writeInboxFile(
  disk: ComputerDisk,
  filename: string,
  bytes: Uint8Array,
): Promise<{ path: string; size: number }> {
  if (bytes.byteLength > MAX_COMPUTER_WRITE_BYTES) {
    throw new ComputerWriteError("That file is too large for this computer.");
  }
  if (!disk.writeFile && !disk.writeFileBytes) {
    throw new ComputerWriteError();
  }
  try {
    await disk.mkdir?.(COMPUTER_INBOX_DIR, { recursive: true });
  } catch {
    // writeFile may still create the folder.
  }
  const path = await uniqueInboxPath(disk, filename);
  if (isTextBytes(path, bytes) && disk.writeFile) {
    await disk.writeFile(path, new TextDecoder().decode(bytes));
  } else if (disk.writeFileBytes) {
    await disk.writeFileBytes(path, bytes);
  } else if (disk.writeFile) {
    await disk.writeFile(path, new TextDecoder("latin1").decode(bytes));
  } else {
    throw new ComputerWriteError();
  }
  return { path, size: bytes.byteLength };
}

async function uniqueInboxPath(
  disk: ComputerDisk,
  filename: string,
): Promise<string> {
  const name = sanitizeAttachmentName(filename);
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let n = 0; n < 200; n++) {
    const candidate =
      n === 0
        ? `${COMPUTER_INBOX_DIR}/${name}`
        : `${COMPUTER_INBOX_DIR}/${stem}-${n}${ext}`;
    const path = sanitizeComputerPath(candidate);
    if (!(await pathExists(disk, path))) return path;
  }
  throw new ComputerWriteError("Could not place that file on this computer.");
}

async function pathExists(disk: ComputerDisk, path: string): Promise<boolean> {
  if (disk.stat) {
    try {
      return Boolean(await disk.stat(path));
    } catch {
      return false;
    }
  }
  try {
    return (await disk.readFile(path)) != null;
  } catch {
    return false;
  }
}

function isTextBytes(path: string, bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return isTextFile(path, text);
  } catch {
    return false;
  }
}

function addParentDirs(byPath: Map<string, ComputerEntry>, path: string) {
  const parts = path.split("/");
  for (let i = 1; i < parts.length; i++) {
    const dir = parts.slice(0, i).join("/");
    if (!byPath.has(dir)) byPath.set(dir, { path: dir, kind: "dir" });
  }
}

async function collectEntries(
  disk: ComputerDisk,
  path: string,
): Promise<ComputerEntry[]> {
  const dir = path || ".";
  const rows: ComputerEntry[] = [];
  const seen = new Set<string>();
  const push = (entry: ComputerEntry) => {
    if (!entry.path || seen.has(entry.path)) return;
    seen.add(entry.path);
    rows.push(entry);
  };
  let listed = false;
  try {
    if (disk.readDir) {
      await walkDir(disk, dir, path, push, 0, new Set());
      listed = true;
    }
  } catch {
    // Missing folders are empty.
  }
  if (!listed) {
    try {
      if (disk.glob) {
        const pattern = path ? `${path}/*` : "*";
        const found = await disk.glob(pattern);
        if (Array.isArray(found)) {
          for (const item of found) {
            const entry = asEntry(item, path);
            if (entry) push(entry);
          }
        }
      }
    } catch {
      // Missing folders are empty.
    }
  }
  if (path && rows.length === 0) {
    const info = await disk.stat?.(path);
    if (info) {
      push({
        path,
        kind: info.type === "directory" || info.type === "dir" ? "dir" : "file",
        size: typeof info.size === "number" ? info.size : undefined,
      });
    }
  }
  return rows;
}

async function walkDir(
  disk: ComputerDisk,
  dir: string,
  root: string,
  push: (entry: ComputerEntry) => void,
  depth: number,
  visited: Set<string>,
): Promise<void> {
  if (!disk.readDir || depth > MAX_COMPUTER_DEPTH) return;
  const key = dir === "." || dir === "/" ? "" : dir;
  if (visited.has(key)) return;
  visited.add(key);
  const found = await disk.readDir(key, {
    limit: MAX_COMPUTER_ENTRIES,
  });
  if (!Array.isArray(found)) return;
  for (const item of found) {
    const entry = asEntry(item, key);
    if (!entry || entry.path === key) continue;
    if (root && entry.path !== root && !entry.path.startsWith(`${root}/`)) {
      continue;
    }
    push(entry);
    if (entry.kind === "dir") {
      await walkDir(disk, entry.path, root, push, depth + 1, visited);
    }
  }
}

function asEntry(item: unknown, parent: string): ComputerEntry | null {
  if (typeof item === "string") {
    const path = joinPath(parent, normalizePath(item));
    return path ? { path, kind: "file" } : null;
  }
  if (!item || typeof item !== "object") return null;
  const row = item as {
    path?: unknown;
    name?: unknown;
    type?: unknown;
    kind?: unknown;
    size?: unknown;
  };
  const raw =
    typeof row.path === "string"
      ? row.path
      : typeof row.name === "string"
        ? row.name
        : "";
  const path = joinPath(parent, normalizePath(raw));
  if (!path) return null;
  const type =
    typeof row.type === "string"
      ? row.type
      : typeof row.kind === "string"
        ? row.kind
        : "file";
  const kind: ComputerEntry["kind"] =
    type === "directory" || type === "dir" ? "dir" : "file";
  return {
    path,
    kind,
    size: typeof row.size === "number" ? row.size : undefined,
  };
}

function joinPath(parent: string, child: string): string {
  const path = child.includes("/") || !parent ? child : `${parent}/${child}`;
  if (!path || path.split("/").length > MAX_COMPUTER_DEPTH) return "";
  return path;
}

function normalizePath(path: string): string {
  const cleaned = path.replace(/^\.?\//u, "").replace(/\/+$/u, "");
  if (!cleaned || cleaned === "." || cleaned === "..") return "";
  return cleaned;
}

function isTextFile(path: string, content: string): boolean {
  if (content.includes("\0")) return false;
  const file = path.split("/").at(-1) ?? path;
  const index = file.lastIndexOf(".");
  const ext = index === -1 ? "" : file.slice(index).toLowerCase();
  if (ext && !TEXT_EXTENSIONS.has(ext)) return false;
  return true;
}
