/** TinyFish Search + Fetch. Public web for office tools — not the computer browser. */

import {
  FETCH_MAX_MODEL_CHARS,
  type FetchDisk,
  type FetchUrlResult,
  urlMatchesAllowlist,
} from "./public-fetch.js";

export const TINYFISH_SEARCH_URL = "https://api.search.tinyfish.ai";
export const TINYFISH_FETCH_URL = "https://api.fetch.tinyfish.ai";
export const TINYFISH_SEARCH_LIMIT = 8;

export type TinyfishKeySource = {
  TINYFISH_API_KEY?: string | null;
  TINYFISH_API_KEYS?: string | null;
};

/** Comma / whitespace / semicolon pool. `TINYFISH_API_KEYS` plus the single-key alias. */
export function parseTinyfishKeys(
  source?: TinyfishKeySource | string | null | readonly string[],
): string[] {
  const raw = Array.isArray(source)
    ? source.join(",")
    : typeof source === "string" || source == null
      ? (source ?? "")
      : [source.TINYFISH_API_KEYS, source.TINYFISH_API_KEY]
          .filter(Boolean)
          .join(",");
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const part of raw.split(/[\s,;]+/u)) {
    const key = part.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

export function tinyfishPoolStart(seed: string, count: number): number {
  if (count <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % count;
}

/** Round-robin across a key pool. Keep one instance per RoomActor. */
export class TinyfishKeyPool {
  private index: number;

  constructor(
    private readonly keys: readonly string[],
    start = 0,
  ) {
    const n = keys.length;
    this.index = n === 0 ? 0 : ((start % n) + n) % n;
  }

  get size(): number {
    return this.keys.length;
  }

  take(): string | undefined {
    if (this.keys.length === 0) return undefined;
    const key = this.keys[this.index];
    this.index = (this.index + 1) % this.keys.length;
    return key;
  }
}

export type TinyfishAuth = {
  apiKey?: string | null;
  keys?: TinyfishKeyPool | readonly string[];
};

export function tinyfishKeyPool(auth: TinyfishAuth = {}): TinyfishKeyPool {
  if (auth.keys instanceof TinyfishKeyPool) return auth.keys;
  if (Array.isArray(auth.keys)) return new TinyfishKeyPool(parseTinyfishKeys(auth.keys));
  return new TinyfishKeyPool(parseTinyfishKeys(auth.apiKey));
}

export function tinyfishConfigured(
  source?: TinyfishAuth | string | null | readonly string[] | TinyfishKeyPool,
): boolean {
  if (source instanceof TinyfishKeyPool) return source.size > 0;
  if (Array.isArray(source) || typeof source === "string" || source == null) {
    return parseTinyfishKeys(source).length > 0;
  }
  return tinyfishKeyPool(source).size > 0;
}

export type TinyfishSearchHit = {
  position: number;
  title: string;
  snippet: string;
  url: string;
  siteName?: string;
};

export type TinyfishSearchOk = {
  ok: true;
  query: string;
  results: TinyfishSearchHit[];
};

export type TinyfishErr = { ok: false; message: string };

export type TinyfishSearchResult = TinyfishSearchOk | TinyfishErr;

export async function runTinyfishSearch(opts: {
  query: string;
  purpose?: string;
  apiKey?: string | null;
  keys?: TinyfishKeyPool | readonly string[];
  fetch?: typeof fetch;
  limit?: number;
}): Promise<TinyfishSearchResult> {
  const query = opts.query.trim();
  if (!query) return { ok: false, message: "Ask what to search." };
  const fetchFn = opts.fetch ?? globalThis.fetch;
  if (typeof fetchFn !== "function") {
    return { ok: false, message: "Web search is unavailable here." };
  }
  const url = new URL(TINYFISH_SEARCH_URL);
  url.searchParams.set("query", query);
  const purpose = opts.purpose?.trim();
  if (purpose) url.searchParams.set("purpose", purpose.slice(0, 2000));
  return withTinyfishKey(
    opts,
    { ok: false, message: "Web search is not set up." },
    async (apiKey) => {
      let response: Response;
      try {
        response = await fetchFn(url, {
          method: "GET",
          headers: { "X-API-Key": apiKey, accept: "application/json" },
        });
      } catch (error) {
        return {
          retry: false,
          value: {
            ok: false as const,
            message:
              error instanceof Error
                ? error.message
                : "Could not search the web.",
          },
        };
      }
      const payload = await readJson(response);
      if (response.status === 429) {
        return {
          retry: true,
          value: {
            ok: false as const,
            message: tinyfishErrorMessage(payload, 429),
          },
        };
      }
      if (!response.ok) {
        return {
          retry: false,
          value: {
            ok: false as const,
            message: tinyfishErrorMessage(payload, response.status),
          },
        };
      }
      const limit = Math.min(
        Math.max(opts.limit ?? TINYFISH_SEARCH_LIMIT, 1),
        20,
      );
      return {
        retry: false,
        value: {
          ok: true as const,
          query: stringField(payload.query) || query,
          results: parseSearchHits(payload).slice(0, limit),
        },
      };
    },
  );
}

export async function runTinyfishFetch(opts: {
  url: string;
  apiKey?: string | null;
  keys?: TinyfishKeyPool | readonly string[];
  fetch?: typeof fetch;
  maxModelChars?: number;
  workspace?: FetchDisk;
  spillToWorkspace?: boolean;
}): Promise<FetchUrlResult> {
  const url = opts.url.trim();
  if (!urlMatchesAllowlist(url)) {
    return {
      ok: false,
      message: "That URL is not on the public allowlist.",
    };
  }
  const fetchFn = opts.fetch ?? globalThis.fetch;
  if (typeof fetchFn !== "function") {
    return { ok: false, message: "fetch_url is unavailable here." };
  }
  return withTinyfishKey(
    opts,
    { ok: false, message: "Web fetch is not set up." },
    async (apiKey) => {
      let response: Response;
      try {
        response = await fetchFn(TINYFISH_FETCH_URL, {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({ urls: [url], format: "markdown" }),
        });
      } catch (error) {
        return {
          retry: false,
          value: {
            ok: false as const,
            message:
              error instanceof Error
                ? error.message
                : "Could not fetch that URL.",
          },
        };
      }
      const payload = await readJson(response);
      if (response.status === 429) {
        return {
          retry: true,
          value: {
            ok: false as const,
            message: tinyfishErrorMessage(payload, 429),
          },
        };
      }
      if (!response.ok) {
        return {
          retry: false,
          value: {
            ok: false as const,
            message: tinyfishErrorMessage(payload, response.status),
          },
        };
      }
      const failed = firstFetchError(payload, url);
      if (failed) {
        return { retry: false, value: { ok: false as const, message: failed } };
      }
      const page = firstFetchPage(payload);
      if (!page) {
        return {
          retry: false,
          value: { ok: false as const, message: "TinyFish returned no page." },
        };
      }
      const finalUrl = page.url || url;
      const body = page.text;
      const maxChars = opts.maxModelChars ?? FETCH_MAX_MODEL_CHARS;
      const spill =
        Boolean(opts.spillToWorkspace && opts.workspace) &&
        body.length > maxChars;
      if (spill && opts.workspace) {
        const path = tinyfishSpillPath(finalUrl);
        await opts.workspace.mkdir?.("inbox/fetch", { recursive: true });
        await opts.workspace.writeFile(path, body);
        return {
          retry: false,
          value: {
            ok: true as const,
            url: finalUrl,
            status: 200,
            contentType: "text/markdown",
            path,
            bytes: body.length,
            truncated: false,
          },
        };
      }
      const truncated = body.length > maxChars;
      return {
        retry: false,
        value: {
          ok: true as const,
          url: finalUrl,
          status: 200,
          contentType: "text/markdown",
          body: truncated ? body.slice(0, maxChars) : body,
          truncated,
          bytes: body.length,
        },
      };
    },
  );
}

async function withTinyfishKey<T>(
  auth: TinyfishAuth,
  missing: T,
  run: (apiKey: string) => Promise<{ retry: boolean; value: T }>,
): Promise<T> {
  const pool = tinyfishKeyPool(auth);
  if (pool.size === 0) return missing;
  const attempts = pool.size;
  let last: T = missing;
  for (let i = 0; i < attempts; i++) {
    const apiKey = pool.take();
    if (!apiKey) break;
    const next = await run(apiKey);
    last = next.value;
    if (!next.retry) return next.value;
  }
  return last;
}

function parseSearchHits(payload: Record<string, unknown>): TinyfishSearchHit[] {
  const rows = Array.isArray(payload.results) ? payload.results : [];
  const hits: TinyfishSearchHit[] = [];
  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const item = row as Record<string, unknown>;
    const url = stringField(item.url);
    if (!url) continue;
    hits.push({
      position:
        typeof item.position === "number" && Number.isFinite(item.position)
          ? item.position
          : index + 1,
      title: stringField(item.title) || url,
      snippet: stringField(item.snippet),
      url,
      siteName: stringField(item.site_name) || undefined,
    });
  }
  return hits;
}

function firstFetchPage(payload: Record<string, unknown>): {
  url: string;
  text: string;
} | null {
  const rows = Array.isArray(payload.results) ? payload.results : [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const item = row as Record<string, unknown>;
    const text = stringField(item.text);
    if (!text) continue;
    return {
      url: stringField(item.final_url) || stringField(item.url),
      text,
    };
  }
  return null;
}

function firstFetchError(
  payload: Record<string, unknown>,
  url: string,
): string | null {
  const rows = Array.isArray(payload.errors) ? payload.errors : [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const item = row as Record<string, unknown>;
    const message = stringField(item.error) || stringField(item.message);
    if (message) return message;
  }
  if (rows.length > 0) return `Could not fetch ${url}.`;
  return null;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const raw = (await response.json()) as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
  } catch {
    // Not JSON.
  }
  return {};
}

function tinyfishErrorMessage(
  payload: Record<string, unknown>,
  status: number,
): string {
  const message =
    stringField(payload.message) ||
    stringField(payload.error) ||
    stringField(payload.detail);
  return message || `TinyFish returned ${status}.`;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function tinyfishSpillPath(url: string): string {
  let host = "page";
  try {
    host = new URL(url).hostname.replace(/[^a-z0-9.-]+/giu, "-") || "page";
  } catch {
    /* keep page */
  }
  return `inbox/fetch/${host}-${Date.now().toString(36)}.md`;
}
