/** Public GET allowlist for Think `fetch_url`. Loopback and private nets stay blocked. */
export const PUBLIC_FETCH_ALLOWLIST = ["https://**", "http://**"] as const;

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
};

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

export async function runToMarkdown(opts: {
  input: ToMarkdownInput;
  workspace: MarkdownDisk;
  convert?: (file: MarkdownBytes) => Promise<unknown>;
  sanitizePath: (path: string) => string;
}): Promise<ToMarkdownResult> {
  const html = opts.input.html;
  const path = opts.input.path?.trim();
  if (html != null && path) {
    return { ok: false, message: "Pass html or a path, not both." };
  }
  if (html == null && !path) {
    return {
      ok: false,
      message: "Pass html from fetch_url, or a path on this computer.",
    };
  }

  const name = markdownFileName(opts.input);
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
