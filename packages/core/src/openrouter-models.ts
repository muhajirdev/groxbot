/** Live OpenRouter model list for Settings picker. Public GET; soft-fail offline. */

import {
  OPENROUTER_PROVIDER,
  type ModelCatalogItem,
} from "@groxbot/contracts";

export type OpenRouterListModel = {
  id: string;
  name?: string;
};

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 60 * 60 * 1000;

let memoryCache: { at: number; rows: ModelCatalogItem[] } | null = null;

export function openRouterCatalogId(openRouterId: string): string {
  const id = openRouterId.trim();
  if (!id) return "";
  return id.startsWith("openrouter/") ? id : `openrouter/${id}`;
}

export function openRouterCatalogLabel(row: {
  id: string;
  name?: string;
}): string {
  const name = row.name?.trim();
  if (name) {
    // "OpenAI: GPT-4o" → "GPT-4o" for a tighter picker row.
    const stripped = name.replace(/^[A-Za-z0-9 ._+-]+:\s+/u, "").trim();
    return stripped || name;
  }
  const id = row.id.trim();
  const slash = id.lastIndexOf("/");
  return slash >= 0 ? id.slice(slash + 1) : id;
}

export function parseOpenRouterModelsPayload(
  payload: unknown,
  available: boolean,
): ModelCatalogItem[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const out: ModelCatalogItem[] = [];
  const seen = new Set<string>();
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const idRaw = (row as { id?: unknown }).id;
    if (typeof idRaw !== "string" || !idRaw.trim()) continue;
    const id = openRouterCatalogId(idRaw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name =
      typeof (row as { name?: unknown }).name === "string"
        ? (row as { name: string }).name
        : undefined;
    out.push({
      id,
      label: openRouterCatalogLabel({ id: idRaw, name }),
      provider: OPENROUTER_PROVIDER,
      available,
    });
  }
  out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  return out;
}

export async function fetchOpenRouterCatalog(opts?: {
  fetch?: typeof fetch;
  available?: boolean;
  signal?: AbortSignal;
}): Promise<ModelCatalogItem[]> {
  const available = opts?.available ?? false;
  if (memoryCache && Date.now() - memoryCache.at < CACHE_TTL_MS) {
    return memoryCache.rows.map((row) => ({ ...row, available }));
  }
  const runFetch = opts?.fetch ?? globalThis.fetch;
  if (typeof runFetch !== "function") return [];
  try {
    const signal =
      opts?.signal ??
      (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? AbortSignal.timeout(8_000)
        : undefined);
    const response = await runFetch(OPENROUTER_MODELS_URL, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) return memoryCache?.rows.map((r) => ({ ...r, available })) ?? [];
    const payload: unknown = await response.json();
    const rows = parseOpenRouterModelsPayload(payload, available);
    if (rows.length > 0) {
      memoryCache = {
        at: Date.now(),
        rows: rows.map((row) => ({ ...row, available: false })),
      };
    }
    return rows;
  } catch {
    return memoryCache?.rows.map((row) => ({ ...row, available })) ?? [];
  }
}

/** Reset module cache (tests). */
export function clearOpenRouterCatalogCache(): void {
  memoryCache = null;
}

/**
 * Static curated catalog first, then live OpenRouter models not already listed.
 * Non-OpenRouter static rows keep their availability from the caller.
 */
export function mergeOpenRouterIntoCatalog(
  staticCatalog: readonly ModelCatalogItem[],
  openRouter: readonly ModelCatalogItem[],
): ModelCatalogItem[] {
  const seen = new Set(staticCatalog.map((row) => row.id));
  const extra = openRouter.filter((row) => !seen.has(row.id));
  return [...staticCatalog, ...extra];
}
