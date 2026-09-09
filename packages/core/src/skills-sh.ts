/**
 * skills.sh legacy search — same endpoint as `npx skills find`.
 * Public, no Vercel OIDC. Body still comes from GitHub via skill-import.
 */

import {
  SKILLS_STORE_CATALOG,
  filterSkillsStore,
  getSkillsStoreListing,
  type SkillsStoreDetail,
  type SkillsStoreListing,
} from "@groxbot/contracts";
import {
  createSkillImportHttp,
  readRemoteSkill,
  type SkillImportHttp,
} from "./skill-import.js";

export const SKILLS_SH_SEARCH_URL = "https://skills.sh/api/search";
export const SKILLS_SH_SEARCH_MIN = 2;
export const SKILLS_SH_SEARCH_MAX = 20;

const TRUSTED_OWNERS = new Set([
  "anthropics",
  "openai",
  "vercel-labs",
  "huggingface",
  "nvidia",
  "microsoft",
  "google",
  "supabase",
  "expo",
]);

export type SkillsShHit = {
  id: string;
  skillId?: string;
  name: string;
  installs: number;
  source: string;
};

export type SkillsShSearchHttp = {
  getJson(url: string): Promise<unknown>;
};

export type SkillsStoreSearchResult = {
  skills: SkillsStoreListing[];
  /** curated = local seed; directory = live open-skills search. */
  source: "curated" | "directory";
};

export class SkillsShSearchError extends Error {
  constructor(message = "Could not search the Skills store.") {
    super(message);
    this.name = "SkillsShSearchError";
  }
}

export function skillsShSearchUrl(
  query: string,
  opts?: { limit?: number; owner?: string },
): string {
  const q = query.trim();
  const limit = Math.min(
    Math.max(opts?.limit ?? 12, 1),
    SKILLS_SH_SEARCH_MAX,
  );
  const params = new URLSearchParams({
    q,
    limit: String(limit),
  });
  const owner = opts?.owner?.trim().toLowerCase();
  if (owner) params.set("owner", owner);
  return `${SKILLS_SH_SEARCH_URL}?${params.toString()}`;
}

export function formatSkillsShInstalls(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/u, "")}M installs`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/u, "")}K installs`;
  }
  return `${count} install${count === 1 ? "" : "s"}`;
}

export function skillsShTrust(owner: string): SkillsStoreListing["trust"] {
  return TRUSTED_OWNERS.has(owner.trim().toLowerCase())
    ? "trusted"
    : "community";
}

/** Import path: prefer `{owner}/{repo}/{skill}` so we file one playbook. */
export function skillsShInstallSource(hit: SkillsShHit): string {
  const id = hit.id.trim().replace(/^\/+|\/+$/gu, "");
  if (id.split("/").filter(Boolean).length >= 3) return id;
  const skill = (hit.skillId || hit.name || "").trim();
  const source = hit.source.trim().replace(/^\/+|\/+$/gu, "");
  if (source && skill) return `${source}/${skill}`;
  return source || id;
}

export function mapSkillsShHit(hit: SkillsShHit): SkillsStoreListing {
  const id = hit.id.trim();
  const source = skillsShInstallSource(hit);
  const owner = (hit.source.split("/")[0] || id.split("/")[0] || "").trim();
  const installs = formatSkillsShInstalls(hit.installs);
  return {
    id,
    name: hit.name.trim() || id.split("/").at(-1) || "skill",
    blurb: installs || "Open skill",
    category: "Skills",
    source,
    trust: skillsShTrust(owner),
    homepage: `https://skills.sh/${id}`,
  };
}

export function parseSkillsShSearch(raw: unknown): SkillsShHit[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const skills = (raw as { skills?: unknown }).skills;
  if (!Array.isArray(skills)) return [];
  const hits: SkillsShHit[] = [];
  for (const row of skills) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const item = row as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const source = typeof item.source === "string" ? item.source.trim() : "";
    if (!id || !name || !source) continue;
    hits.push({
      id,
      name,
      source,
      skillId:
        typeof item.skillId === "string" ? item.skillId.trim() : undefined,
      installs:
        typeof item.installs === "number" && Number.isFinite(item.installs)
          ? item.installs
          : 0,
    });
  }
  return hits;
}

/**
 * Empty / short query → curated seed. Otherwise open directory search, with
 * matching curated rows prepended (deduped by install source).
 */
export async function searchSkillsStore(
  query: string,
  opts: {
    limit?: number;
    owner?: string;
    category?: string | null;
    http?: SkillsShSearchHttp;
  } = {},
): Promise<SkillsStoreSearchResult> {
  const q = query.trim();
  const limit = Math.min(
    Math.max(opts.limit ?? 12, 1),
    SKILLS_SH_SEARCH_MAX,
  );
  if (q.length < SKILLS_SH_SEARCH_MIN) {
    return {
      skills: filterSkillsStore(
        SKILLS_STORE_CATALOG,
        q,
        opts.category ?? null,
      ).slice(0, limit),
      source: "curated",
    };
  }

  const http = opts.http ?? createSkillsShSearchHttp();
  let remote: SkillsStoreListing[] = [];
  try {
    const raw = await http.getJson(
      skillsShSearchUrl(q, { limit, owner: opts.owner }),
    );
    remote = parseSkillsShSearch(raw)
      .sort((a, b) => (b.installs || 0) - (a.installs || 0))
      .map(mapSkillsShHit);
  } catch {
    // Fall through to curated matches when the directory is down.
  }

  const curated = filterSkillsStore(SKILLS_STORE_CATALOG, q, null);
  const seen = new Set<string>();
  const skills: SkillsStoreListing[] = [];
  for (const row of [...curated, ...remote]) {
    const key = row.source.toLowerCase();
    if (seen.has(key) || seen.has(row.id.toLowerCase())) continue;
    seen.add(key);
    seen.add(row.id.toLowerCase());
    skills.push(row);
    if (skills.length >= limit) break;
  }
  return {
    skills,
    source: remote.length > 0 ? "directory" : "curated",
  };
}

/** Curated id, or a directory `{owner}/{repo}/{skill}` id. */
export function resolveSkillsStoreListing(
  id: string,
): SkillsStoreListing | undefined {
  const curated = getSkillsStoreListing(id);
  if (curated) return curated;
  const trimmed = id.trim().replace(/^\/+|\/+$/gu, "");
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length < 3) return undefined;
  const owner = parts[0] ?? "";
  const skill = parts.at(-1) ?? "";
  if (!owner || !skill) return undefined;
  return {
    id: trimmed,
    name: skill,
    blurb: "Open skill",
    category: "Skills",
    source: trimmed,
    trust: skillsShTrust(owner),
    homepage: `https://skills.sh/${trimmed}`,
  };
}

export async function readSkillsStoreSkill(
  idOrSource: string,
  opts?: { http?: SkillImportHttp },
): Promise<SkillsStoreDetail> {
  const trimmed = idOrSource.trim();
  const resolved = resolveSkillsStoreListing(trimmed);
  const listing: SkillsStoreListing = resolved ?? {
    id: trimmed,
    name: trimmed.split("/").filter(Boolean).at(-1) || "skill",
    blurb: "Open skill",
    category: "Skills",
    source: trimmed,
    trust: skillsShTrust(trimmed.split("/")[0] || ""),
    homepage: `https://github.com/${trimmed}`,
  };

  const http = opts?.http ?? createSkillImportHttp();
  const loaded = await readRemoteSkill({ source: listing.source }, http);

  return {
    id: listing.id,
    name: listing.name || loaded.name,
    blurb: listing.blurb,
    category: listing.category,
    source: listing.source,
    trust: listing.trust,
    homepage: listing.homepage,
    description: loaded.description || listing.blurb,
    content: loaded.content,
    resources: loaded.resources,
  };
}

export function createSkillsShSearchHttp(
  fetchImpl: typeof fetch = fetch,
): SkillsShSearchHttp {
  return {
    async getJson(url) {
      const res = await fetchImpl(url, {
        headers: { Accept: "application/json", "User-Agent": "Groxbot" },
      });
      if (!res.ok) {
        throw new SkillsShSearchError(
          `Skills store search failed (${res.status}).`,
        );
      }
      return res.json();
    },
  };
}
