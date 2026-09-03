export type KnowledgeGraphSnapshot = {
  paths: string[];
  out: number[][];
};

export type KnowledgeGraphIndex = KnowledgeGraphSnapshot & {
  byPath: Map<string, number>;
  incoming: number[][];
};

/** Invert outgoing ints once. */
export function indexKnowledgeGraph(
  snap: KnowledgeGraphSnapshot,
): KnowledgeGraphIndex {
  const byPath = new Map<string, number>();
  for (let i = 0; i < snap.paths.length; i++) {
    const path = snap.paths[i];
    if (path) byPath.set(path, i);
  }
  const incoming = snap.paths.map(() => [] as number[]);
  for (let from = 0; from < snap.out.length; from++) {
    for (const dest of snap.out[from] ?? []) {
      if (dest >= 0 && dest < incoming.length) incoming[dest]?.push(from);
    }
  }
  return { paths: snap.paths, out: snap.out, byPath, incoming };
}

export function knowledgeGraphBacklinks(
  index: KnowledgeGraphIndex,
  path: string,
): string[] {
  const target = index.byPath.get(path);
  if (target == null) return [];
  const sources: string[] = [];
  for (const from of index.incoming[target] ?? []) {
    const source = index.paths[from];
    if (source) sources.push(source);
  }
  return sources.sort();
}

export function knowledgeGraphOutgoing(
  index: KnowledgeGraphIndex,
  path: string,
): string[] {
  const id = index.byPath.get(path);
  if (id == null) return [];
  const dests: string[] = [];
  for (const to of index.out[id] ?? []) {
    const dest = index.paths[to];
    if (dest) dests.push(dest);
  }
  return dests.sort();
}

export function graphNodeLabel(path: string): string {
  return path.split("/").filter(Boolean).at(-1) || path;
}
