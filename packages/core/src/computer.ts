/** This bot’s Computer workspace. Not a Postgres catalog. */

import {
  COMPUTER_INBOX_DIR,
  type ComputerDownload,
  type ComputerEntry,
  type ComputerFile,
  type ComputerList,
  MAX_COMPUTER_WRITE_BYTES,
  parseOfficeUserMeta,
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
  readFileBytes?(path: string): Promise<Uint8Array | null>;
  glob?(pattern: string): Promise<unknown>;
  readDir?(path: string, opts?: { limit?: number }): Promise<unknown>;
  stat?(path: string): Promise<{ type?: string; size?: number } | null>;
  writeFile?(path: string, content: string): Promise<void>;
  writeFileBytes?(path: string, content: Uint8Array): Promise<void>;
  mkdir?(path: string, opts?: { recursive?: boolean }): Promise<void>;
  rm?(
    path: string,
    opts?: { recursive?: boolean; force?: boolean },
  ): Promise<void>;
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

export async function downloadComputerFile(
  disk: ComputerDisk,
  rawPath: string,
): Promise<ComputerDownload> {
  const path = sanitizeComputerPath(rawPath);
  if (!path) throw new ComputerPathError("Pick a file on this computer.");
  const bytes = await readComputerBytes(disk, path);
  if (bytes.byteLength > MAX_COMPUTER_WRITE_BYTES) {
    throw new ComputerWriteError("That file is too large to download.");
  }
  return {
    path,
    filename: path.split("/").at(-1) ?? path,
    content: encodeComputerBytes(bytes),
    mediaType: mediaTypeForComputerPath(path),
  };
}

export function mediaTypeForComputerPath(path: string): string {
  const file = path.split("/").at(-1) ?? path;
  const index = file.lastIndexOf(".");
  const ext = index === -1 ? "" : file.slice(index).toLowerCase();
  return MEDIA_TYPES[ext] ?? "application/octet-stream";
}

async function readComputerBytes(
  disk: ComputerDisk,
  path: string,
): Promise<Uint8Array> {
  if (disk.readFileBytes) {
    try {
      const bytes = await disk.readFileBytes(path);
      if (bytes) return bytes;
    } catch {
      // Fall through to text read.
    }
  }
  let content: string | null;
  try {
    content = await disk.readFile(path);
  } catch {
    throw new ComputerFileError();
  }
  if (content == null) throw new ComputerFileError();
  if (isTextFile(path, content)) return new TextEncoder().encode(content);
  const bytes = new Uint8Array(content.length);
  for (let i = 0; i < content.length; i++) {
    bytes[i] = content.charCodeAt(i) & 0xff;
  }
  return bytes;
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

export function encodeComputerBytes(bytes: Uint8Array): string {
  const buffer = (
    globalThis as {
      Buffer?: { from(data: Uint8Array): { toString(enc: string): string } };
    }
  ).Buffer;
  if (buffer) return buffer.from(bytes).toString("base64");
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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
  const size = typeof row.size === "number" ? row.size : undefined;
  // Think's write tool mkdir()s a relative file path, then writeFile() stores
  // bytes without flipping type — so a "directory" can hold file content.
  const kind: ComputerEntry["kind"] =
    (type === "directory" || type === "dir") && !(size && size > 0)
      ? "dir"
      : "file";
  return {
    path,
    kind,
    size,
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

const MEDIA_TYPES: Record<string, string> = {
  ".css": "text/css",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".htm": "text/html",
  ".html": "text/html",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".jsx": "text/javascript",
  ".md": "text/markdown",
  ".mjs": "text/javascript",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".py": "text/x-python",
  ".svg": "image/svg+xml",
  ".ts": "text/plain",
  ".tsx": "text/plain",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
};

const patchedWorkspaces = new WeakSet<object>();

/** Last path segment looks like a file Think's write tool should not mkdir. */
export function computerPathLooksLikeFile(path: string): boolean {
  const file =
    path.replace(/^\/+/u, "").split("/").filter(Boolean).at(-1) ?? "";
  const index = file.lastIndexOf(".");
  if (index <= 0) return false;
  const ext = file.slice(index).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || Boolean(MEDIA_TYPES[ext]);
}

/**
 * Think's write tool does `path.replace(/\/[^/]+$/, "")` for the parent.
 * On `essay-car.md` that is the file itself, so it mkdir()s a directory,
 * then writeFile() stores bytes without flipping `type` to file.
 */
export function patchComputerWorkspace<T extends ComputerDisk>(disk: T): T {
  if (patchedWorkspaces.has(disk)) return disk;
  patchedWorkspaces.add(disk);
  const origMkdir = disk.mkdir?.bind(disk);
  const origWriteFile = disk.writeFile?.bind(disk);
  const origWriteFileBytes = disk.writeFileBytes?.bind(disk);
  const origRm = disk.rm?.bind(disk);
  const origStat = disk.stat?.bind(disk);

  if (origMkdir) {
    disk.mkdir = async (path, opts) => {
      if (computerPathLooksLikeFile(path)) return;
      await origMkdir(path, opts);
    };
  }

  if (origWriteFile) {
    disk.writeFile = async (path, content) => {
      await replaceDirectoryAt(path, origStat, origRm);
      await origWriteFile(path, content);
    };
  }

  if (origWriteFileBytes) {
    disk.writeFileBytes = async (path, content) => {
      await replaceDirectoryAt(path, origStat, origRm);
      await origWriteFileBytes(path, content);
    };
  }

  return disk;
}

/** Think Workspace SQLite table (default namespace). */
export const THINK_WORKSPACE_TABLE = "cf_workspace_default";

/** Directory rows that already hold file bytes become files so list/read work. */
export function healThinkWorkspaceFileRows(sql: {
  exec(query: string): unknown;
}): void {
  try {
    sql.exec(
      `UPDATE ${THINK_WORKSPACE_TABLE} SET type = 'file' WHERE type = 'directory' AND size > 0`,
    );
  } catch {
    // Fresh actor — table does not exist yet.
  }
}

async function replaceDirectoryAt(
  path: string,
  origStat: ComputerDisk["stat"] | undefined,
  origRm: ComputerDisk["rm"] | undefined,
): Promise<void> {
  if (!origStat || !origRm) return;
  let info: { type?: string; size?: number } | null = null;
  try {
    info = await origStat(path);
  } catch {
    return;
  }
  const type = info?.type;
  if (type !== "directory" && type !== "dir") return;
  await origRm(path, { recursive: true, force: true });
}

type HostedChatMessage = {
  role: string;
  content?: unknown;
  parts?: unknown;
  metadata?: unknown;
};

function isDirectMediaPart(part: unknown): boolean {
  if (!part || typeof part !== "object") return false;
  const type = (part as { type?: unknown }).type;
  return type === "file" || type === "image";
}

function withoutDirectMedia<T>(list: T[]): T[] {
  return list.filter((part) => !isDirectMediaPart(part));
}

function speakerPrefix(name: string): string {
  return `${name}: `;
}

function labelTextParts(list: unknown[], name: string): unknown[] {
  const prefix = speakerPrefix(name);
  let labeled = false;
  let changed = false;
  const next = list.map((part) => {
    if (labeled || !part || typeof part !== "object") return part;
    const row = part as { type?: unknown; text?: unknown };
    if (row.type !== "text" || typeof row.text !== "string") return part;
    labeled = true;
    if (row.text.startsWith(prefix)) return part;
    changed = true;
    return { ...row, text: `${prefix}${row.text}` };
  });
  return changed ? next : list;
}

function withSpeakerLabel<T extends HostedChatMessage>(message: T): T {
  if (message.role !== "user") return message;
  const user = parseOfficeUserMeta(message.metadata);
  if (!user) return message;
  let row = message;
  if (Array.isArray(message.parts)) {
    const parts = labelTextParts(message.parts, user.name);
    if (parts !== message.parts) row = { ...row, parts };
  }
  if (Array.isArray(message.content)) {
    const content = labelTextParts(message.content, user.name);
    if (content !== message.content) row = { ...row, content };
  } else if (typeof message.content === "string") {
    const prefix = speakerPrefix(user.name);
    if (!message.content.startsWith(prefix)) {
      row = { ...row, content: `${prefix}${message.content}` };
    }
  }
  return row;
}

/**
 * Files live on the computer. Drop file/image parts so the model only sees
 * the inbox path as text — never a workspace path stuffed into `url`.
 * User turns keep metadata.user; the model sees `Name: …` on the text.
 */
export function hostedChatMessages<T extends HostedChatMessage>(
  messages: T[],
): T[] {
  let changed = false;
  const next = messages.map((message) => {
    let row = message;
    if (Array.isArray(message.parts)) {
      const parts = withoutDirectMedia(message.parts);
      if (parts.length !== message.parts.length) {
        changed = true;
        row = { ...row, parts };
      }
    }
    if (Array.isArray(message.content)) {
      const content = withoutDirectMedia(message.content);
      if (content.length !== message.content.length) {
        changed = true;
        row = { ...row, content };
      }
    }
    const labeled = withSpeakerLabel(row);
    if (labeled !== row) {
      changed = true;
      row = labeled;
    }
    return row;
  });
  return changed ? next : messages;
}
