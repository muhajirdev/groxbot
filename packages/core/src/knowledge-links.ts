/** Disposable office-link snapshot on R2. Markdown is the truth; this is a cache.
 *
 * On disk: path dictionary + outgoing int edges (Parquet-style).
 * One-file backlinks scan `out`. The graph view is one GET; invert in RAM
 * (browser or this request) — do not persist `incoming`.
 */

export const KNOWLEDGE_LINKS_PATH = "_links/index.json";
export const KNOWLEDGE_LINKS_VERSION = 1;
export const MAX_KNOWLEDGE_LINK_SOURCES = 4_000;
const MAX_PATH = 240;

export type KnowledgeLinkSnapshot = {
  v: typeof KNOWLEDGE_LINKS_VERSION;
  rev: number;
  updatedAt: string;
  paths: string[];
  out: number[][];
};

type KnowledgeLinkGraph = KnowledgeLinkSnapshot & {
  byPath: Map<string, number>;
  incoming: number[][];
};

export function isKnowledgeLinksPath(path: string): boolean {
  return path === "_links" || path.startsWith("_links/");
}

export function emptyKnowledgeLinkSnapshot(): KnowledgeLinkSnapshot {
  return {
    v: KNOWLEDGE_LINKS_VERSION,
    rev: 0,
    updatedAt: new Date(0).toISOString(),
    paths: [],
    out: [],
  };
}

export function parseKnowledgeLinkSnapshot(
  raw: string,
): KnowledgeLinkSnapshot | null {
  try {
    const value = JSON.parse(raw) as Partial<KnowledgeLinkSnapshot>;
    if (value.v !== KNOWLEDGE_LINKS_VERSION) return null;
    if (!Array.isArray(value.paths) || !Array.isArray(value.out)) return null;
    if (value.paths.length !== value.out.length) return null;
    const paths = value.paths.filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    );
    if (paths.length !== value.paths.length) return null;
    const out = value.out.map((row) =>
      Array.isArray(row)
        ? row.filter(
            (id): id is number =>
              Number.isInteger(id) && id >= 0 && id < paths.length,
          )
        : [],
    );
    return {
      v: KNOWLEDGE_LINKS_VERSION,
      rev: typeof value.rev === "number" && value.rev >= 0 ? value.rev : 0,
      updatedAt:
        typeof value.updatedAt === "string"
          ? value.updatedAt
          : new Date(0).toISOString(),
      paths,
      out,
    };
  } catch {
    return null;
  }
}

/** Office-root markdown href. No ../, no wiki links, no http. */
export function parseOfficeMarkdownHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:/iu.test(trimmed)) return null;
  const pathPart = trimmed.split(/[?#]/u, 1)[0] ?? "";
  const normalized = pathPart.replaceAll("\\", "/").replace(/^\/+/u, "");
  if (!normalized || normalized === ".") return null;
  const parts: string[] = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part === ".." || part.includes("\0") || /[\[\]]/u.test(part)) {
      return null;
    }
    parts.push(part);
  }
  const path = parts.join("/");
  if (!path || path.length > MAX_PATH || isKnowledgeLinksPath(path)) return null;
  return path;
}

export function extractOfficeMarkdownPaths(markdown: string): string[] {
  const stripped = markdown
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/`[^`]*`/gu, " ");
  const found = new Set<string>();
  const re = /!?\[([^\]]*)\]\(([^)]+)\)/gu;
  let match = re.exec(stripped);
  while (match) {
    if (!match[0].startsWith("!")) {
      const path = parseOfficeMarkdownHref(match[2] ?? "");
      if (path) found.add(path);
    }
    match = re.exec(stripped);
  }
  return [...found].sort();
}

export function indexesMarkdownForLinks(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown");
}

export function setKnowledgeLinkSource(
  snapshot: KnowledgeLinkSnapshot,
  source: string,
  dests: readonly string[],
): KnowledgeLinkSnapshot {
  const graph = graphFromSnapshot(snapshot);
  const unique = [
    ...new Set(dests.filter((path) => path && path !== source)),
  ].sort();
  const from = intern(graph, source);
  if (from == null) return snapshot;
  const nextOut: number[] = [];
  for (const dest of unique) {
    const to = intern(graph, dest);
    if (to != null) nextOut.push(to);
  }
  graph.out[from] = nextOut;
  return commitGraph(graph, snapshot.rev + 1);
}

export function dropKnowledgeLinkSource(
  snapshot: KnowledgeLinkSnapshot,
  source: string,
): KnowledgeLinkSnapshot {
  const graph = graphFromSnapshot(snapshot);
  const from = graph.byPath.get(source);
  if (from == null) return snapshot;
  if ((graph.out[from] ?? []).length === 0) return snapshot;
  graph.out[from] = [];
  return commitGraph(graph, snapshot.rev + 1);
}

export function dropKnowledgeLinkPrefix(
  snapshot: KnowledgeLinkSnapshot,
  prefix: string,
): KnowledgeLinkSnapshot {
  const folder = prefix.replace(/\/+$/u, "");
  const graph = graphFromSnapshot(snapshot);
  let changed = false;
  for (let i = 0; i < graph.paths.length; i++) {
    const path = graph.paths[i] ?? "";
    if (path !== folder && !path.startsWith(`${folder}/`)) continue;
    if ((graph.out[i] ?? []).length === 0) continue;
    graph.out[i] = [];
    changed = true;
  }
  if (!changed) return snapshot;
  return commitGraph(graph, snapshot.rev + 1);
}

export function knowledgeBacklinks(
  snapshot: KnowledgeLinkSnapshot,
  path: string,
): string[] {
  const target = snapshot.paths.indexOf(path);
  if (target === -1) return [];
  const sources: string[] = [];
  for (let i = 0; i < snapshot.out.length; i++) {
    if (i === target) continue;
    if (snapshot.out[i]?.includes(target)) {
      const source = snapshot.paths[i];
      if (source) sources.push(source);
    }
  }
  return sources.sort();
}

export function encodeKnowledgeLinkSnapshot(
  snapshot: KnowledgeLinkSnapshot,
): string {
  return JSON.stringify({
    v: snapshot.v,
    rev: snapshot.rev,
    updatedAt: snapshot.updatedAt,
    paths: snapshot.paths,
    out: snapshot.out,
  });
}

function graphFromSnapshot(snapshot: KnowledgeLinkSnapshot): KnowledgeLinkGraph {
  const byPath = new Map<string, number>();
  for (let i = 0; i < snapshot.paths.length; i++) {
    const path = snapshot.paths[i];
    if (path) byPath.set(path, i);
  }
  const incoming = snapshot.paths.map(() => [] as number[]);
  for (let from = 0; from < snapshot.out.length; from++) {
    for (const dest of snapshot.out[from] ?? []) {
      incoming[dest]?.push(from);
    }
  }
  return {
    v: snapshot.v,
    rev: snapshot.rev,
    updatedAt: snapshot.updatedAt,
    paths: [...snapshot.paths],
    out: snapshot.out.map((row) => [...row]),
    byPath,
    incoming,
  };
}

function intern(graph: KnowledgeLinkGraph, path: string): number | null {
  const existing = graph.byPath.get(path);
  if (existing != null) return existing;
  if (graph.paths.length >= MAX_KNOWLEDGE_LINK_SOURCES) return null;
  const id = graph.paths.length;
  graph.paths.push(path);
  graph.out.push([]);
  graph.incoming.push([]);
  graph.byPath.set(path, id);
  return id;
}

function commitGraph(
  graph: KnowledgeLinkGraph,
  rev: number,
): KnowledgeLinkSnapshot {
  return compactKnowledgeLinkSnapshot({
    v: KNOWLEDGE_LINKS_VERSION,
    rev,
    updatedAt: new Date().toISOString(),
    paths: graph.paths,
    out: graph.out,
  });
}

function compactKnowledgeLinkSnapshot(
  snapshot: KnowledgeLinkSnapshot,
): KnowledgeLinkSnapshot {
  const keep = new Uint8Array(snapshot.paths.length);
  for (let i = 0; i < snapshot.out.length; i++) {
    const row = snapshot.out[i] ?? [];
    if (row.length === 0) continue;
    keep[i] = 1;
    for (const dest of row) keep[dest] = 1;
  }
  let live = 0;
  for (const bit of keep) live += bit;
  if (live === snapshot.paths.length) return snapshot;

  const remap = new Int32Array(snapshot.paths.length).fill(-1);
  const paths: string[] = [];
  for (let old = 0; old < snapshot.paths.length; old++) {
    if (!keep[old]) continue;
    const path = snapshot.paths[old];
    if (!path) continue;
    remap[old] = paths.length;
    paths.push(path);
  }
  const out: number[][] = [];
  for (let old = 0; old < snapshot.paths.length; old++) {
    const mapped = remap[old];
    if (mapped === undefined || mapped < 0) continue;
    const next: number[] = [];
    for (const dest of snapshot.out[old] ?? []) {
      const to = remap[dest];
      if (to === undefined || to < 0) continue;
      next.push(to);
    }
    out[mapped] = next;
  }
  return { ...snapshot, paths, out };
}
