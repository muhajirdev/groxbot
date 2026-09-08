import {
  TOOL_TRUNCATE_MAX_BYTES,
  TOOL_TRUNCATE_MAX_LINES,
  truncateHead,
} from "./tool-truncate.js";

export type MarkdownBytes = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type MarkdownDisk = {
  readFile(path: string): Promise<string | null>;
  readFileBytes?(path: string): Promise<Uint8Array | null>;
};

export type ToMarkdownOk = {
  ok: true;
  name: string;
  mimeType: string;
  markdown: string;
  tokens?: number;
};

export type ToMarkdownErr = { ok: false; message: string };

export type ToMarkdownResult = ToMarkdownOk | ToMarkdownErr;

export type ToMarkdownInput = {
  html?: string;
  path?: string;
  name?: string;
  /** 1-indexed markdown line, same as computer `read` offset. */
  offset?: number;
};

/** Same window as Pi `read` / computer files so a ~19k invoice is one result. */
export const TO_MARKDOWN_PAGE_BYTES = TOOL_TRUNCATE_MAX_BYTES;
export const TO_MARKDOWN_SPILL_DIR = "/workspace/.tool-output";

export type MarkdownWriteDisk = MarkdownDisk & {
  writeFile?(path: string, content: string): Promise<void> | void;
  mkdir?(
    path: string,
    opts?: { recursive?: boolean },
  ): Promise<void> | void;
};

export function toMarkdownSpillPath(name: string): string {
  const file = name.split(/[/\\]/u).pop() || "document";
  const stem = file.replace(/\.[^.]+$/u, "") || file;
  const safe =
    stem.replace(/[^\w.-]+/gu, "-").replace(/^-+|-+$/gu, "") || "document";
  return `${TO_MARKDOWN_SPILL_DIR}/${safe}.md`;
}

export function presentToMarkdown(
  result: ToMarkdownOk,
  opts?: { offset?: number; spillPath?: string },
): string {
  const lines = splitMarkdownLines(result.markdown);
  const startLine = Math.max(1, Math.floor(opts?.offset ?? 1));
  if (lines.length > 0 && startLine > lines.length) {
    return `Offset ${startLine} is beyond end of markdown (${lines.length} lines). Full text: ${opts?.spillPath ?? "re-run to_markdown"}.`;
  }
  const selected = lines.slice(startLine - 1).join("\n");
  const head = truncateHead(selected, {
    maxLines: TOOL_TRUNCATE_MAX_LINES,
    maxBytes: TO_MARKDOWN_PAGE_BYTES,
  });
  const outputLines = head.firstLineExceedsLimit
    ? 1
    : head.outputLines;
  const shownEnd = startLine + Math.max(outputLines, 1) - 1;
  const next = shownEnd + 1;
  const more =
    head.firstLineExceedsLimit ||
    head.truncated ||
    next <= lines.length;
  const saved =
    more && opts?.spillPath
      ? `Saved full markdown (${result.markdown.length} chars, ${lines.length} lines) to ${opts.spillPath}. Continue with read({ path: "${opts.spillPath}", offset: ${next} }) — do not convert again.\n\n`
      : "";
  let body = head.firstLineExceedsLimit
    ? selected.slice(0, TO_MARKDOWN_PAGE_BYTES)
    : head.content;
  if (head.truncated || head.firstLineExceedsLimit || startLine > 1) {
    const of = lines.length;
    const end = Math.min(shownEnd, Math.max(of, 1));
    body += `\n\n[Showing lines ${startLine}-${end} of ${of}.`;
    body += more ? ` Use offset=${next} to continue.]` : "]";
  }
  return `${saved}${body}`;
}

function splitMarkdownLines(content: string): string[] {
  if (content.length === 0) return [];
  const lines = content.split("\n");
  if (content.endsWith("\n")) lines.pop();
  return lines;
}

const MIME_BY_EXT: Record<string, string> = {
  bmp: "image/bmp",
  gif: "image/gif",
  htm: "text/html",
  html: "text/html",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  md: "text/markdown",
  markdown: "text/markdown",
  pdf: "application/pdf",
  png: "image/png",
  svg: "image/svg+xml",
  txt: "text/plain",
  webp: "image/webp",
  xml: "application/xml",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function markdownFileName(input: ToMarkdownInput): string {
  const named = input.name?.trim();
  if (named) return named.split(/[/\\]/u).pop() || named;
  if (input.path?.trim()) {
    const base = input.path.trim().split(/[/\\]/u).pop();
    if (base) return base;
  }
  if (input.html != null) return "page.html";
  return "document";
}

export function mimeTypeForMarkdownName(name: string, html?: string): string {
  if (html != null) return "text/html";
  const file = name.split(/[/\\]/u).pop() ?? name;
  const index = file.lastIndexOf(".");
  const ext = index === -1 ? "" : file.slice(index + 1).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export function isMarkdownName(name: string): boolean {
  const file = name.toLowerCase();
  return file.endsWith(".md") || file.endsWith(".markdown");
}

export function readMarkdownConversion(result: unknown): ToMarkdownResult {
  const row = Array.isArray(result) ? result[0] : result;
  if (!row || typeof row !== "object") {
    return { ok: false, message: "Markdown conversion returned nothing." };
  }
  const rec = row as {
    name?: unknown;
    mimeType?: unknown;
    mimetype?: unknown;
    format?: unknown;
    data?: unknown;
    error?: unknown;
    tokens?: unknown;
  };
  const name = typeof rec.name === "string" && rec.name.trim() ? rec.name : "document";
  const mimeType =
    (typeof rec.mimeType === "string" && rec.mimeType) ||
    (typeof rec.mimetype === "string" && rec.mimetype) ||
    "text/markdown";
  if (rec.format === "error") {
    const error =
      typeof rec.error === "string" && rec.error.trim()
        ? rec.error
        : "Markdown conversion failed.";
    return { ok: false, message: error };
  }
  if (typeof rec.data !== "string") {
    return { ok: false, message: "Markdown conversion returned no text." };
  }
  const tokens = typeof rec.tokens === "number" ? rec.tokens : undefined;
  return {
    ok: true,
    name,
    mimeType,
    markdown: rec.data,
    tokens,
  };
}

function presentString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function runToMarkdown(opts: {
  input: ToMarkdownInput;
  workspace: MarkdownDisk;
  convert?: (file: MarkdownBytes) => Promise<unknown>;
  sanitizePath: (path: string) => string;
}): Promise<ToMarkdownResult> {
  const html = presentString(opts.input.html);
  const path = presentString(opts.input.path);
  if (html != null && path) {
    return { ok: false, message: "Pass html or a path, not both." };
  }
  if (html == null && !path) {
    return {
      ok: false,
      message: "Pass html from fetch_url, or a path on this computer.",
    };
  }

  const name = markdownFileName({ ...opts.input, html, path });
  try {
    if (path && isMarkdownName(name)) {
      const filePath = opts.sanitizePath(path);
      const text = await opts.workspace.readFile(filePath);
      if (text == null) return { ok: false, message: "File not found." };
      return {
        ok: true,
        name,
        mimeType: "text/markdown",
        markdown: text,
      };
    }

    let bytes: Uint8Array;
    if (html != null) {
      bytes = new TextEncoder().encode(html);
    } else {
      bytes = await readMarkdownBytes(
        opts.workspace,
        opts.sanitizePath(path ?? ""),
      );
    }

    const mimeType = mimeTypeForMarkdownName(name, html ?? undefined);
    if (!opts.convert) {
      return {
        ok: false,
        message: "Markdown conversion is not available on this host.",
      };
    }
    return readMarkdownConversion(
      await opts.convert({ name, mimeType, bytes }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Markdown conversion failed.";
    return { ok: false, message };
  }
}

export async function persistToMarkdownPage(
  result: ToMarkdownResult,
  opts?: {
    offset?: number;
    workspace?: MarkdownWriteDisk;
    spillPath?: string;
  },
): Promise<ToMarkdownResult | string> {
  if (!result.ok) return result;
  let spillPath: string | undefined;
  const disk = opts?.workspace;
  if (disk?.writeFile) {
    spillPath = opts?.spillPath ?? toMarkdownSpillPath(result.name);
    try {
      await disk.mkdir?.(TO_MARKDOWN_SPILL_DIR, { recursive: true });
      await disk.writeFile(spillPath, result.markdown);
    } catch {
      spillPath = undefined;
    }
  }
  return presentToMarkdown(result, {
    offset: opts?.offset,
    spillPath,
  });
}

function shouldReuseMarkdownSpill(input: ToMarkdownInput): boolean {
  const html = presentString(input.html);
  const path = presentString(input.path);
  if (input.offset != null) return true;
  return Boolean(path) && html == null;
}

/**
 * Convert once, spill the .md, page like Pi `read`. Offset and a repeat
 * path convert reuse the spill — they do not call Workers AI again.
 */
export async function runToMarkdownPaged(opts: {
  input: ToMarkdownInput;
  workspace: MarkdownWriteDisk;
  convert?: (file: MarkdownBytes) => Promise<unknown>;
  sanitizePath: (path: string) => string;
}): Promise<ToMarkdownResult | string> {
  const html = presentString(opts.input.html);
  const path = presentString(opts.input.path);
  const name = markdownFileName({ ...opts.input, html, path });
  const spillPath = toMarkdownSpillPath(name);
  const spilled = await opts.workspace.readFile(spillPath);
  if (
    typeof spilled === "string" &&
    spilled.length > 0 &&
    shouldReuseMarkdownSpill(opts.input)
  ) {
    return presentToMarkdown(
      {
        ok: true,
        name,
        mimeType: mimeTypeForMarkdownName(name, html),
        markdown: spilled,
      },
      { offset: opts.input.offset, spillPath },
    );
  }
  const result = await runToMarkdown(opts);
  return persistToMarkdownPage(result, {
    offset: opts.input.offset,
    workspace: opts.workspace,
    spillPath,
  });
}

async function readMarkdownBytes(
  disk: MarkdownDisk,
  path: string,
): Promise<Uint8Array> {
  if (disk.readFileBytes) {
    const bytes = await disk.readFileBytes(path);
    if (bytes) return bytes;
  }
  const text = await disk.readFile(path);
  if (text == null) throw new Error("File not found.");
  return new TextEncoder().encode(text);
}
