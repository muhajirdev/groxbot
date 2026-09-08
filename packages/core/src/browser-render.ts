/** Resolve HTML/URL/path and write Browser Run PDF/PNG onto the computer. */

import { sanitizeComputerPath } from "./computer.js";

export type BrowserRenderDisk = {
  readFile(path: string): Promise<string | null>;
  writeFileBytes?(path: string, content: Uint8Array): Promise<void> | void;
  mkdir?(
    path: string,
    opts?: { recursive?: boolean },
  ): Promise<void> | void;
};

export type BrowserQuickAction = {
  quickAction(
    action: "pdf" | "screenshot",
    body: { html?: string; url?: string },
  ): Promise<Response>;
};

export type BrowserRenderSource = {
  html?: string;
  url?: string;
  path?: string;
  out?: string;
};

export type BrowserRenderOk = {
  ok: true;
  path: string;
  bytes: number;
  mediaType: string;
};

export type BrowserRenderErr = { ok: false; message: string };

export type BrowserRenderResult = BrowserRenderOk | BrowserRenderErr;

export type ResolvedBrowserPage =
  | { ok: true; html?: string; url?: string }
  | { ok: false; message: string };

export async function resolveBrowserPage(
  workspace: BrowserRenderDisk,
  input: BrowserRenderSource,
): Promise<ResolvedBrowserPage> {
  const html = typeof input.html === "string" ? input.html : undefined;
  const url = typeof input.url === "string" ? input.url.trim() : "";
  const path = typeof input.path === "string" ? input.path.trim() : "";

  if (html != null && html.length > 0) {
    return { ok: true, html };
  }
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, message: "url must be http(s)." };
      }
    } catch {
      return { ok: false, message: "url is not a valid URL." };
    }
    return { ok: true, url };
  }
  if (path) {
    let rel: string;
    try {
      rel = sanitizeComputerPath(path);
    } catch {
      return { ok: false, message: "path is not allowed." };
    }
    if (!rel) return { ok: false, message: "path is empty." };
    const body = await workspace.readFile(rel);
    if (body == null) {
      return { ok: false, message: `No file at ${rel}.` };
    }
    return { ok: true, html: body };
  }
  return {
    ok: false,
    message: "Pass html, url, or path (HTML on this computer).",
  };
}

export function browserRenderOutPath(
  action: "pdf" | "screenshot",
  out?: string,
): string | { error: string } {
  const ext = action === "pdf" ? "pdf" : "png";
  if (out?.trim()) {
    try {
      const path = sanitizeComputerPath(out);
      if (!path) return { error: "out is empty." };
      return path;
    } catch {
      return { error: "out is not allowed." };
    }
  }
  return `inbox/render/${Date.now().toString(36)}.${ext}`;
}

export async function writeBrowserRenderBytes(
  workspace: BrowserRenderDisk,
  path: string,
  bytes: Uint8Array,
): Promise<BrowserRenderErr | null> {
  if (!workspace.writeFileBytes) {
    return { ok: false, message: "This computer cannot write binary files." };
  }
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  if (dir) await workspace.mkdir?.(dir, { recursive: true });
  await workspace.writeFileBytes(path, bytes);
  return null;
}

export async function runBrowserQuickAction(
  browser: BrowserQuickAction,
  workspace: BrowserRenderDisk,
  action: "pdf" | "screenshot",
  input: BrowserRenderSource,
): Promise<BrowserRenderResult> {
  const page = await resolveBrowserPage(workspace, input);
  if (!page.ok) return page;

  const out = browserRenderOutPath(action, input.out);
  if (typeof out === "object") return { ok: false, message: out.error };

  const body =
    page.html != null ? { html: page.html } : { url: page.url as string };
  let response: Response;
  try {
    response = await browser.quickAction(action, body);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : `Browser ${action} failed.`,
    };
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    return {
      ok: false,
      message: `Browser ${action} failed (${response.status}): ${detail || "empty response"}`,
    };
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const writeErr = await writeBrowserRenderBytes(workspace, out, bytes);
  if (writeErr) return writeErr;

  return {
    ok: true,
    path: out,
    bytes: bytes.length,
    mediaType: action === "pdf" ? "application/pdf" : "image/png",
  };
}
