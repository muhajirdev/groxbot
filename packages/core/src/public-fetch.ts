/** Public GET for `fetch_url`. Loopback and private nets stay blocked. */

export const PUBLIC_FETCH_ALLOWLIST = ["https://**", "http://**"] as const;
export const FETCH_MAX_BYTES = 1_048_576;
export const FETCH_MAX_MODEL_CHARS = 32_000;

export type FetchDisk = {
  writeFile(path: string, content: string): Promise<void> | void;
  writeFileBytes?(path: string, content: Uint8Array): Promise<void> | void;
  mkdir?(
    path: string,
    opts?: { recursive?: boolean },
  ): Promise<void> | void;
};

export type FetchUrlOk = {
  ok: true;
  url: string;
  status: number;
  contentType: string;
  body?: string;
  truncated?: boolean;
  path?: string;
  bytes?: number;
};

export type FetchUrlErr = { ok: false; message: string };

export type FetchUrlResult = FetchUrlOk | FetchUrlErr;

export function urlMatchesAllowlist(
  url: string,
  allowlist: readonly string[] = PUBLIC_FETCH_ALLOWLIST,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (isBlockedFetchHost(parsed.hostname)) return false;
  const href = parsed.href;
  return allowlist.some((pattern) => globRe(pattern).test(href));
}

export function isBlockedFetchHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/u, "");
  if (!host) return true;
  const bare = host.replace(/^\[|\]$/gu, "");
  if (
    bare === "localhost" ||
    bare.endsWith(".localhost") ||
    bare.endsWith(".local") ||
    bare.endsWith(".internal") ||
    bare === "0.0.0.0" ||
    bare === "::" ||
    bare === "::1"
  ) {
    return true;
  }
  return isPrivateIp(bare);
}

export async function runPublicFetch(opts: {
  url: string;
  allowlist?: readonly string[];
  maxBytes?: number;
  maxModelChars?: number;
  fetch?: typeof fetch;
  workspace?: FetchDisk;
  spillToWorkspace?: boolean;
}): Promise<FetchUrlResult> {
  const url = opts.url.trim();
  if (!urlMatchesAllowlist(url, opts.allowlist)) {
    return {
      ok: false,
      message: "That URL is not on the public allowlist.",
    };
  }
  const fetchFn = opts.fetch ?? globalThis.fetch;
  if (typeof fetchFn !== "function") {
    return { ok: false, message: "fetch_url is unavailable here." };
  }
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "GET",
      redirect: "follow",
      headers: { accept: "text/html, text/plain, application/json, */*" },
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not fetch that URL.",
    };
  }
  const maxBytes = opts.maxBytes ?? FETCH_MAX_BYTES;
  const bytes = await readCappedBytes(response, maxBytes);
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const finalUrl = response.url || url;
  const textLike = isTextContentType(contentType);
  const overflow = bytes.truncated;
  const spill =
    Boolean(opts.spillToWorkspace && opts.workspace) &&
    (!textLike || overflow || bytes.body.byteLength > (opts.maxModelChars ?? FETCH_MAX_MODEL_CHARS));
  if (spill && opts.workspace) {
    const path = fetchSpillPath(finalUrl, contentType);
    await opts.workspace.mkdir?.("inbox/fetch", { recursive: true });
    if (opts.workspace.writeFileBytes) {
      await opts.workspace.writeFileBytes(path, bytes.body);
    } else {
      await opts.workspace.writeFile(path, new TextDecoder().decode(bytes.body));
    }
    return {
      ok: true,
      url: finalUrl,
      status: response.status,
      contentType,
      path,
      bytes: bytes.body.byteLength,
      truncated: overflow,
      message: overflow
        ? `Saved on this computer as ${path} (truncated at ${maxBytes} bytes).`
        : `Saved on this computer as ${path}.`,
    };
  }
  const maxChars = opts.maxModelChars ?? FETCH_MAX_MODEL_CHARS;
  const body = new TextDecoder().decode(bytes.body);
  const truncated = overflow || body.length > maxChars;
  return {
    ok: true,
    url: finalUrl,
    status: response.status,
    contentType,
    body: truncated ? body.slice(0, maxChars) : body,
    truncated,
    bytes: bytes.body.byteLength,
  };
}

function isTextContentType(contentType: string): boolean {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return (
    type.startsWith("text/") ||
    type === "application/json" ||
    type === "application/xml" ||
    type === "application/javascript" ||
    type.endsWith("+json") ||
    type.endsWith("+xml")
  );
}

function fetchSpillPath(url: string, contentType: string): string {
  let host = "page";
  try {
    host = new URL(url).hostname.replace(/[^a-z0-9.-]+/giu, "-") || "page";
  } catch {
    /* keep page */
  }
  const ext = extensionForContentType(contentType);
  const stamp = Date.now().toString(36);
  return `inbox/fetch/${host}-${stamp}.${ext}`;
}

function extensionForContentType(contentType: string): string {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type.includes("html")) return "html";
  if (type.includes("json")) return "json";
  if (type.includes("pdf")) return "pdf";
  if (type.includes("xml")) return "xml";
  if (type.startsWith("text/")) return "txt";
  return "bin";
}

async function readCappedBytes(
  response: Response,
  maxBytes: number,
): Promise<{ body: Uint8Array; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength <= maxBytes) return { body: buffer, truncated: false };
    return { body: buffer.slice(0, maxBytes), truncated: true };
  }
  const parts: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      const room = maxBytes - total;
      if (room <= 0) {
        truncated = true;
        break;
      }
      if (value.byteLength > room) {
        parts.push(value.slice(0, room));
        total += room;
        truncated = true;
        break;
      }
      parts.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.byteLength;
  }
  return { body, truncated };
}

function globRe(pattern: string): RegExp {
  const body = pattern
    .replace(/[.+^${}()|[\]\\]/gu, "\\$&")
    .replace(/\*\*/gu, "\u0000")
    .replace(/\*/gu, "[^/]*")
    .replace(/\u0000/gu, ".*")
    .replace(/\?/gu, ".");
  return new RegExp(`^${body}$`);
}

function isPrivateIp(host: string): boolean {
  if (host.includes(":")) {
    const mapped = ipv4Mapped(host);
    if (mapped) return isPrivateIpv4(mapped);
    return (
      host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe8") ||
      host.startsWith("fe9") ||
      host.startsWith("fea") ||
      host.startsWith("feb")
    );
  }
  return isPrivateIpv4(host);
}

function ipv4Mapped(host: string): string | null {
  const match = host.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/iu);
  return match?.[1] ?? null;
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}
