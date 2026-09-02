import { bench, describe } from "vitest";
import {
  knowledgeBacklinks,
  type KnowledgeLinkSnapshot,
} from "./knowledge-links.js";

const NODES = 4_000;
const EDGES_PER = 3;
const QUERIES = 2_000;

const snapshot = buildSnapshot(NODES, EDGES_PER);
const queryPaths = snapshot.paths.filter((_, i) => i % 7 === 0).slice(0, QUERIES);

function oldBacklinks(
  snap: KnowledgeLinkSnapshot,
  path: string,
): string[] {
  const target = snap.paths.indexOf(path);
  if (target === -1) return [];
  const sources: string[] = [];
  for (let i = 0; i < snap.out.length; i++) {
    if (i === target) continue;
    if (snap.out[i]?.includes(target)) {
      const source = snap.paths[i];
      if (source) sources.push(source);
    }
  }
  return sources;
}

function graphFromSnapshot(snap: KnowledgeLinkSnapshot) {
  const byPath = new Map<string, number>();
  for (let i = 0; i < snap.paths.length; i++) {
    const path = snap.paths[i];
    if (path) byPath.set(path, i);
  }
  const incoming = snap.paths.map(() => [] as number[]);
  for (let from = 0; from < snap.out.length; from++) {
    for (const dest of snap.out[from] ?? []) incoming[dest]?.push(from);
  }
  return { byPath, incoming, paths: snap.paths };
}

function newBacklinksLoaded(
  graph: ReturnType<typeof graphFromSnapshot>,
  path: string,
): string[] {
  const target = graph.byPath.get(path);
  if (target == null) return [];
  const sources: string[] = [];
  for (const from of graph.incoming[target] ?? []) {
    const source = graph.paths[from];
    if (source) sources.push(source);
  }
  return sources;
}

describe("backlinks: previous indexOf+scan vs Map+incoming", () => {
  bench("previous: indexOf + scan out (per query)", () => {
    for (const path of queryPaths) oldBacklinks(snapshot, path);
  });

  bench("current: rebuild Map+incoming every query", () => {
    for (const path of queryPaths) knowledgeBacklinks(snapshot, path);
  });

  bench("loaded once: Map+incoming, then O(degree) lookups", () => {
    const graph = graphFromSnapshot(snapshot);
    for (const path of queryPaths) newBacklinksLoaded(graph, path);
  });
});

describe("path → id lookup", () => {
  bench("previous: paths.indexOf", () => {
    for (const path of queryPaths) snapshot.paths.indexOf(path);
  });

  bench("current: Map.get after one build", () => {
    const byPath = new Map(snapshot.paths.map((path, i) => [path, i]));
    for (const path of queryPaths) byPath.get(path);
  });
});

function buildSnapshot(nodes: number, edgesPer: number): KnowledgeLinkSnapshot {
  const paths = Array.from({ length: nodes }, (_, i) => `notes/n-${i}.md`);
  const out = paths.map((_, i) => {
    const row: number[] = [];
    for (let k = 1; k <= edgesPer; k++) row.push((i + k * 97) % nodes);
    return row;
  });
  return {
    v: 1,
    rev: 1,
    updatedAt: new Date(0).toISOString(),
    paths,
    out,
  };
}
