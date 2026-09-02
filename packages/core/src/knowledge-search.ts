/** Disposable office-search snapshot on R2. Markdown is the truth; this is a cache.
 *
 * On disk: one `{workspaceId}/_search/index.json` (path, title, description, excerpt).
 * Hidden from the tree. Rebuilt on first miss; a write rewrites the file.
 * Cap is `MAX_KNOWLEDGE_ENTRIES` — a Worker rebuild is one R2 GET per note.
 */

import { parseSkillMarkdown, SKILL_FILE } from "./skills.js";

export const KNOWLEDGE_SEARCH_PATH = "_search/index.json";
export const KNOWLEDGE_SEARCH_LEGACY_MANIFEST = "_search/manifest.json";
export const KNOWLEDGE_SEARCH_SEGMENT_DIR = "_search/s";
export const KNOWLEDGE_SEARCH_VERSION = 4;
export const MAX_KNOWLEDGE_SEARCH_TEXT = 24_000;
export const MAX_KNOWLEDGE_SEARCH_HITS = 12;
export const MAX_KNOWLEDGE_READ_MANY = 8;

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const SNIPPET = 180;

export type KnowledgeSearchDoc = {
  path: string;
  title: string;
  description: string;
  text: string;
};

export type KnowledgeSearchSnapshot = {
  v: typeof KNOWLEDGE_SEARCH_VERSION;
  rev: number;
  updatedAt: string;
  docs: KnowledgeSearchDoc[];
};

export type KnowledgeSearchHit = {
  path: string;
  title: string;
  description: string;
  score: number;
  snippet: string;
};

export function isKnowledgeSearchPath(path: string): boolean {
  return path === "_search" || path.startsWith("_search/");
}

export function emptyKnowledgeSearchSnapshot(): KnowledgeSearchSnapshot {
  return {
    v: KNOWLEDGE_SEARCH_VERSION,
    rev: 0,
    updatedAt: new Date(0).toISOString(),
    docs: [],
  };
}

export type KnowledgeSearchManifest = {
  v: typeof KNOWLEDGE_SEARCH_VERSION;
  rev: number;
  updatedAt: string;
  segments: string[];
};

export function encodeKnowledgeSearchSnapshot(
  snapshot: KnowledgeSearchSnapshot,
): string {
  return JSON.stringify({
    v: KNOWLEDGE_SEARCH_VERSION,
    rev: snapshot.rev,
    updatedAt: snapshot.updatedAt,
    docs: snapshot.docs,
  });
}

export function parseKnowledgeSearchDocs(raw: string): KnowledgeSearchDoc[] | null {
  try {
    const value = JSON.parse(raw) as { docs?: unknown; v?: unknown };
    if (value.v === 3 && !Array.isArray(value.docs)) return null;
    const rows = Array.isArray(value.docs) ? value.docs : null;
    if (!rows) return null;
    const docs: KnowledgeSearchDoc[] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const rec = row as {
        path?: unknown;
        title?: unknown;
        description?: unknown;
        text?: unknown;
      };
      if (typeof rec.path !== "string" || !rec.path) continue;
      docs.push({
        path: rec.path,
        title: typeof rec.title === "string" ? rec.title : "",
        description: typeof rec.description === "string" ? rec.description : "",
        text: typeof rec.text === "string" ? rec.text : "",
      });
    }
    return docs;
  } catch {
    return null;
  }
}

export function parseKnowledgeSearchSnapshot(
  raw: string,
): KnowledgeSearchSnapshot | null {
  try {
    const value = JSON.parse(raw) as Partial<KnowledgeSearchSnapshot>;
    if (value.v !== 3 && value.v !== KNOWLEDGE_SEARCH_VERSION) return null;
    const docs = parseKnowledgeSearchDocs(raw);
    if (!docs) return null;
    return {
      v: KNOWLEDGE_SEARCH_VERSION,
      rev: typeof value.rev === "number" && value.rev >= 0 ? value.rev : 0,
      updatedAt:
        typeof value.updatedAt === "string"
          ? value.updatedAt
          : new Date(0).toISOString(),
      docs,
    };
  } catch {
    return null;
  }
}

export function parseKnowledgeSearchManifest(
  raw: string,
): KnowledgeSearchManifest | null {
  try {
    const value = JSON.parse(raw) as Partial<KnowledgeSearchManifest>;
    if (value.v !== KNOWLEDGE_SEARCH_VERSION) return null;
    if (!Array.isArray(value.segments)) return null;
    const segments: string[] = [];
    for (const row of value.segments) {
      if (typeof row !== "string" || !row) continue;
      if (!isKnowledgeSearchSegmentPath(row)) return null;
      segments.push(row);
    }
    return {
      v: KNOWLEDGE_SEARCH_VERSION,
      rev: typeof value.rev === "number" && value.rev >= 0 ? value.rev : 0,
      updatedAt:
        typeof value.updatedAt === "string"
          ? value.updatedAt
          : new Date(0).toISOString(),
      segments,
    };
  } catch {
    return null;
  }
}

export function isKnowledgeSearchSegmentPath(path: string): boolean {
  return (
    path.startsWith(`${KNOWLEDGE_SEARCH_SEGMENT_DIR}/`) &&
    !path.includes("..") &&
    path.endsWith(".json") &&
    path.slice(KNOWLEDGE_SEARCH_SEGMENT_DIR.length + 1).indexOf("/") === -1
  );
}

export function knowledgeSearchDoc(
  path: string,
  content: string | null,
): KnowledgeSearchDoc {
  const name = path.split("/").at(-1) ?? path;
  const fallback = displayName(name);
  if (content == null) {
    return { path, title: fallback, description: "", text: "" };
  }
  const skill = isSkillFile(path) ? parseSkillMarkdown(content) : null;
  const matter = parseNoteFrontmatter(content);
  const title =
    skill?.name ||
    matter.title ||
    firstHeading(content) ||
    fallback;
  const description =
    skill?.description || matter.description || matter.oneline || "";
  const body = skill?.body ?? content;
  const headings = markdownHeadings(body);
  const text = [description, headings, clip(body, MAX_KNOWLEDGE_SEARCH_TEXT)]
    .filter(Boolean)
    .join("\n");
  return { path, title, description, text };
}

export function setKnowledgeSearchDoc(
  snapshot: KnowledgeSearchSnapshot,
  doc: KnowledgeSearchDoc,
  cap: number,
): KnowledgeSearchSnapshot {
  const docs = snapshot.docs.filter((row) => row.path !== doc.path);
  const existed = docs.length !== snapshot.docs.length;
  if (!existed && docs.length >= cap) return snapshot;
  docs.push(doc);
  docs.sort((a, b) => a.path.localeCompare(b.path));
  return {
    v: KNOWLEDGE_SEARCH_VERSION,
    rev: snapshot.rev + 1,
    updatedAt: new Date().toISOString(),
    docs,
  };
}

export function dropKnowledgeSearchDoc(
  snapshot: KnowledgeSearchSnapshot,
  path: string,
): KnowledgeSearchSnapshot {
  const docs = snapshot.docs.filter((row) => row.path !== path);
  if (docs.length === snapshot.docs.length) return snapshot;
  return {
    v: KNOWLEDGE_SEARCH_VERSION,
    rev: snapshot.rev + 1,
    updatedAt: new Date().toISOString(),
    docs,
  };
}

export function dropKnowledgeSearchPrefix(
  snapshot: KnowledgeSearchSnapshot,
  prefix: string,
): KnowledgeSearchSnapshot {
  const folder = prefix.replace(/\/+$/u, "");
  const docs = snapshot.docs.filter(
    (row) => row.path !== folder && !row.path.startsWith(`${folder}/`),
  );
  if (docs.length === snapshot.docs.length) return snapshot;
  return {
    v: KNOWLEDGE_SEARCH_VERSION,
    rev: snapshot.rev + 1,
    updatedAt: new Date().toISOString(),
    docs,
  };
}

const CLITIC = /^(.*)(nya|lah|kah|pun|ku|mu)$/u;

export function tokenizeKnowledgeText(raw: string): string[] {
  const tokens: string[] = [];
  for (const part of raw.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (part.length < 2) continue;
    tokens.push(part);
    const stem = stripIndonesianClitic(part);
    if (stem && stem !== part) tokens.push(stem);
  }
  return tokens;
}

export function tokenizeKnowledgeQuery(raw: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const part of tokenizeKnowledgeText(raw)) {
    if (seen.has(part)) continue;
    seen.add(part);
    tokens.push(part);
  }
  return tokens;
}

type SearchField = "path" | "title" | "description" | "text";

const FIELD_WEIGHT: Record<SearchField, number> = {
  path: 4,
  title: 6,
  description: 3,
  text: 1,
};

const COVERAGE_EXP = 2;
const PHRASE_TITLE_BOOST = 1.2;
const PHRASE_BODY_BOOST = 0.6;

type PreparedDoc = {
  doc: KnowledgeSearchDoc;
  fields: Record<SearchField, string[]>;
};

export function rankKnowledgeSearch(
  docs: KnowledgeSearchDoc[],
  query: string,
  limit = MAX_KNOWLEDGE_SEARCH_HITS,
): KnowledgeSearchHit[] {
  const tokens = tokenizeKnowledgeQuery(query);
  const cap = Math.max(1, Math.min(limit, MAX_KNOWLEDGE_SEARCH_HITS));
  if (tokens.length === 0 || docs.length === 0) return [];

  const fields: SearchField[] = ["path", "title", "description", "text"];
  const prepared: PreparedDoc[] = docs.map((doc) => ({
    doc,
    fields: {
      path: tokenizeKnowledgeText(doc.path),
      title: tokenizeKnowledgeText(doc.title),
      description: tokenizeKnowledgeText(doc.description),
      text: tokenizeKnowledgeText(doc.text),
    },
  }));
  const stats = Object.fromEntries(
    fields.map((field) => [field, fieldStats(prepared, field, tokens)]),
  ) as Record<SearchField, FieldStats>;

  const hits: KnowledgeSearchHit[] = [];
  for (const row of prepared) {
    let score = 0;
    const bag = new Set<string>();
    for (const field of fields) {
      const fieldTokens = row.fields[field];
      for (const token of fieldTokens) bag.add(token);
      score += FIELD_WEIGHT[field] * bm25(fieldTokens, tokens, stats[field]);
    }
    if (score <= 0) continue;
    let matched = 0;
    for (const token of tokens) {
      if (bag.has(token)) matched += 1;
    }
    score *= (matched / tokens.length) ** COVERAGE_EXP;
    if (tokens.length >= 2) {
      if (
        hasPhrase(row.fields.title, tokens) ||
        hasPhrase(row.fields.path, tokens)
      ) {
        score *= 1 + PHRASE_TITLE_BOOST;
      } else if (hasPhrase(row.fields.text, tokens)) {
        score *= 1 + PHRASE_BODY_BOOST;
      }
    }
    hits.push({
      path: row.doc.path,
      title: row.doc.title,
      description: row.doc.description,
      score,
      snippet: knowledgeSearchSnippet(row.doc, tokens),
    });
  }
  hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return hits.slice(0, cap);
}

type FieldStats = {
  n: number;
  avgdl: number;
  df: Map<string, number>;
};

function fieldStats(
  docs: PreparedDoc[],
  field: SearchField,
  query: string[],
): FieldStats {
  const df = new Map<string, number>();
  let totalLen = 0;
  for (const row of docs) {
    const tokens = row.fields[field];
    totalLen += tokens.length;
    const uniq = new Set(tokens);
    for (const token of query) {
      if (uniq.has(token)) df.set(token, (df.get(token) ?? 0) + 1);
    }
  }
  return {
    n: docs.length,
    avgdl: totalLen / docs.length || 1,
    df,
  };
}

function bm25(tokens: string[], query: string[], stats: FieldStats): number {
  if (tokens.length === 0) return 0;
  const tf = new Map<string, number>();
  for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
  let score = 0;
  for (const token of query) {
    const freq = tf.get(token) ?? 0;
    if (freq === 0) continue;
    const docsWith = stats.df.get(token) ?? 0;
    const idf = Math.log(1 + (stats.n - docsWith + 0.5) / (docsWith + 0.5));
    const denom =
      freq + BM25_K1 * (1 - BM25_B + BM25_B * (tokens.length / stats.avgdl));
    score += idf * ((freq * (BM25_K1 + 1)) / denom);
  }
  return score;
}

function hasPhrase(seq: string[], query: string[]): boolean {
  if (query.length < 2 || seq.length < query.length) return false;
  for (let i = 0; i <= seq.length - query.length; i++) {
    let ok = true;
    for (let j = 0; j < query.length; j++) {
      if (seq[i + j] !== query[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

export function knowledgeSearchSnippet(
  doc: KnowledgeSearchDoc,
  tokens: string[],
): string {
  const hay = [doc.title, doc.description, doc.text]
    .filter(Boolean)
    .join("\n")
    .replace(/\s+/gu, " ")
    .trim();
  if (!hay) return "";
  const lower = hay.toLowerCase();
  let index = -1;
  for (const token of tokens) {
    const at = lower.indexOf(token);
    if (at === -1) continue;
    if (index === -1 || at < index) index = at;
  }
  if (index === -1) return clip(hay, SNIPPET);
  const start = Math.max(0, index - 40);
  const chunk = hay.slice(start, start + SNIPPET);
  return `${start > 0 ? "…" : ""}${chunk}${start + SNIPPET < hay.length ? "…" : ""}`;
}

function isSkillFile(path: string): boolean {
  return path === SKILL_FILE || path.endsWith(`/${SKILL_FILE}`);
}

function firstHeading(markdown: string): string | null {
  const match = markdown.match(/^#{1,6}\s+(.+)$/mu);
  const heading = match?.[1]?.trim();
  return heading || null;
}

function markdownHeadings(markdown: string): string {
  return [...markdown.matchAll(/^#{1,6}\s+(.+)$/gmu)]
    .map((match) => match[1]?.trim())
    .filter(Boolean)
    .join("\n");
}

function displayName(name: string): string {
  return name.replace(/\.md$/iu, "") || name;
}

function stripIndonesianClitic(token: string): string | null {
  const match = CLITIC.exec(token);
  const stem = match?.[1];
  if (!stem || stem.length < 4) return null;
  return stem;
}

function parseNoteFrontmatter(content: string): {
  title: string;
  description: string;
  oneline: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!match?.[1]) return { title: "", description: "", oneline: "" };
  const block = match[1];
  return {
    title: yamlScalar(block, "title"),
    description: yamlScalar(block, "description"),
    oneline: yamlScalar(block, "oneline"),
  };
}

function yamlScalar(block: string, key: string): string {
  const match = block.match(new RegExp(`^${key}:\\s*(.*)$`, "mu"));
  if (!match?.[1]) return "";
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value.trim();
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}
