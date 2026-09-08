/** Adapt `@cloudflare/computer` `workspace.fs` to the office ComputerDisk. */

import { listComputerEntries } from "./computer.js";

export const COMPUTER_DISK_FLAG = "computer.disk";
export const COMPUTER_DISK_DOFS = "dofs";
/** `@cloudflare/computer` WorkerShellBackend default id. */
export const COMPUTER_SHELL_BACKEND = "worker-shell";
/** Computer tools and Worker shell cwd. VFS schema only creates `/`. */
export const COMPUTER_VFS_ROOT = "/workspace";
export const COMPUTER_SHELL_DESCRIPTION =
  "Fast Worker shell (just-bash) on this bot’s computer. Core text commands only — no Linux container.";
/** Pi-facing bash tool. Computer ships this as `exec` — do not leave both names. */
export const COMPUTER_SHELL_TOOL_NAME = "shell";
export const COMPUTER_SHELL_TOOL_DESCRIPTION = [
  "Bash on this computer (just-bash). Argument is `command`. cwd is /workspace.",
  "This is not the JavaScript sandbox — that is `code` (knowledge, routines, history).",
].join(" ");

export type ComputerWorkerShell = {
  defaultBackend: typeof COMPUTER_SHELL_BACKEND;
  backends: Record<string, { description: string }>;
};

/** `createAITools({ shell })` — Worker shell is the only bash backend. */
export function computerWorkerShell(): ComputerWorkerShell {
  return {
    defaultBackend: COMPUTER_SHELL_BACKEND,
    backends: {
      [COMPUTER_SHELL_BACKEND]: { description: COMPUTER_SHELL_DESCRIPTION },
    },
  };
}

/**
 * Computer file tools ship as `ls` / `exec`. Office exposes `list` / `shell`
 * only — do not leave both names in the catalog (`exec` rhymes with `code`).
 */
export function withComputerOfficeTools<T extends Record<string, unknown>>(
  computerTools: T,
): Omit<T, "ls" | "exec"> & { list?: T["ls"]; shell?: T["exec"] } {
  const { ls, exec, ...rest } = computerTools;
  const out: Record<string, unknown> = { ...rest };
  if (ls !== undefined) out.list = ls;
  if (exec !== undefined) {
    out.shell =
      exec && typeof exec === "object"
        ? { ...exec, description: COMPUTER_SHELL_TOOL_DESCRIPTION }
        : exec;
  }
  return out as Omit<T, "ls" | "exec"> & { list?: T["ls"]; shell?: T["exec"] };
}

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
  glob(pattern: string): Promise<DiskFileInfo[]>;
  readDir(
    dir: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<DiskFileInfo[]>;
  writeFile(path: string, content: string): Promise<void>;
  writeFileBytes(path: string, content: Uint8Array): Promise<void>;
  mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>;
  rm(
    path: string,
    opts?: { recursive?: boolean; force?: boolean },
  ): Promise<void>;
  stat(path: string): Promise<DiskFileInfo | null>;
};

type DiskFileInfo = {
  path: string;
  name: string;
  type: "file" | "directory";
  mimeType: string;
  size: number;
  createdAt: number;
  updatedAt: number;
};

const textEncoder = new TextEncoder();

/** Office paths are relative; Computer VFS paths are absolute. */
export function computerAbsolutePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "." || trimmed === "/") return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function computerRelativePath(path: string): string {
  return path.replace(/^\/+/u, "");
}

/**
 * Computer tools cwd is `/workspace`, so `write({ path: "/workspace/notes.md" })`
 * lands there. Chat chips often pass `notes.md`. Try both.
 */
export function computerVfsPaths(path: string): string[] {
  const abs = computerAbsolutePath(path);
  if (abs === "/" || abs === COMPUTER_VFS_ROOT) return [abs];
  if (abs.startsWith(`${COMPUTER_VFS_ROOT}/`)) return [abs];
  return [abs, `${COMPUTER_VFS_ROOT}${abs}`];
}

const COMPUTER_PATH_ARG_KEYS = ["path", "cwd", "out", "directory"] as const;

export const COMPUTER_PATH_TOOLS = new Set([
  "list",
  "read",
  "write",
  "edit",
  "delete",
  "find",
  "grep",
  "shell",
]);

/**
 * Inbox is a sibling of `/workspace`, not inside it. Models prefix chips with
 * `/workspace` because shell cwd is `/workspace`. Relative files (not inbox)
 * land in that cwd.
 */
export function computerToolAbsolutePath(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "." || trimmed === "/") return "/";
  let abs = computerAbsolutePath(trimmed);
  if (
    abs === `${COMPUTER_VFS_ROOT}/inbox` ||
    abs.startsWith(`${COMPUTER_VFS_ROOT}/inbox/`)
  ) {
    abs = abs.slice(COMPUTER_VFS_ROOT.length) || "/";
  }
  const relative = !trimmed.startsWith("/");
  if (
    relative &&
    abs !== COMPUTER_VFS_ROOT &&
    !abs.startsWith(`${COMPUTER_VFS_ROOT}/`) &&
    abs !== "/inbox" &&
    !abs.startsWith("/inbox/")
  ) {
    return `${COMPUTER_VFS_ROOT}${abs}`;
  }
  return abs;
}

/** CF `createAITools` requires absolute paths and crashes if `find` has no path. */
export function rewriteComputerToolArgs(
  name: string,
  params: Record<string, unknown>,
): Record<string, unknown> {
  if (!COMPUTER_PATH_TOOLS.has(name)) return params;
  const next: Record<string, unknown> = { ...params };
  for (const key of COMPUTER_PATH_ARG_KEYS) {
    if (typeof next[key] === "string") {
      next[key] = computerToolAbsolutePath(next[key] as string);
    }
  }
  if (name === "find") {
    const path = typeof next.path === "string" ? next.path : "";
    if (!path || path === "/") next.path = "/";
  }
  if (name === "list") {
    if (typeof next.path !== "string" || !next.path.trim()) next.path = "/";
  }
  if (name === "shell") {
    if (typeof next.cwd !== "string" || !next.cwd.trim()) {
      next.cwd = COMPUTER_VFS_ROOT;
    }
  }
  return next;
}

const BINARY_READ_EXT =
  /\.(pdf|png|jpe?g|gif|webp|bmp|zip|docx|pptx|xlsx|mp3|mp4|wav|webm)$/i;

/**
 * CF `read` dumps PDF/PNG as base64 `data`. Point the model at `to_markdown`.
 */
export function binaryComputerReadRefusal(
  result: unknown,
): { ok: false; message: string } | null {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const row = result as Record<string, unknown>;
  const path = typeof row.path === "string" ? row.path : typeof row.name === "string" ? row.name : "";
  const media =
    typeof row.mediaType === "string"
      ? row.mediaType
      : typeof row.mimeType === "string"
        ? row.mimeType
        : "";
  const data = typeof row.data === "string" ? row.data : "";
  if (!data) return null;
  const looksBinary =
    BINARY_READ_EXT.test(path) ||
    /^(application\/pdf|image\/|audio\/|video\/|application\/octet-stream|application\/zip)/i.test(
      media,
    ) ||
    data.startsWith("JVBERi") ||
    data.startsWith("iVBORw0") ||
    data.startsWith("/9j/");
  if (!looksBinary) return null;
  if (media.startsWith("text/") || media.includes("json") || media.includes("xml")) {
    return null;
  }
  const rel = computerRelativePath(computerAbsolutePath(path)) || path || "that file";
  const kind = media || (path.match(BINARY_READ_EXT)?.[1] ?? "binary");
  return {
    ok: false,
    message: `That file is binary (${kind}). Use to_markdown({ path: "${rel}" }) — do not read() PDFs or images.`,
  };
}

/** Computer `list` / `shell` cwd is `/workspace`. Create it on the VFS. */
export async function ensureComputerHome(
  fs: Pick<ComputerFs, "mkdir">,
): Promise<void> {
  try {
    await fs.mkdir(COMPUTER_VFS_ROOT, { recursive: true });
  } catch (error) {
    if (!isExists(error)) throw error;
  }
}

export function diskFromComputerFs(fs: ComputerFs): ComputerWorkspaceDisk {
  return {
    async readFile(path) {
      for (const abs of computerVfsPaths(path)) {
        try {
          const text = await fs.readFile(abs, "utf8");
          return typeof text === "string" ? text : null;
        } catch (error) {
          if (isMissing(error)) continue;
          throw error;
        }
      }
      return null;
    },
    async readFileBytes(path) {
      for (const abs of computerVfsPaths(path)) {
        try {
          return await bytesFromFs(fs, abs);
        } catch (error) {
          if (isMissing(error)) continue;
          throw error;
        }
      }
      return null;
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
        if (!found) return matchByWalk(this, pattern);
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
      for (const abs of computerVfsPaths(path)) {
        try {
          const info = await fs.stat(abs);
          const relative = computerRelativePath(abs);
          return toInfo({
            path: relative,
            name: relative.split("/").at(-1) ?? relative,
            directory: Boolean(info.isDirectory) && !info.isFile,
            size: typeof info.size === "number" ? info.size : 0,
            mtime: info.mtime,
          });
        } catch (error) {
          if (isMissing(error)) continue;
          throw error;
        }
      }
      return null;
    },
  };
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
): Promise<DiskFileInfo[]> {
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
}): DiskFileInfo {
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
