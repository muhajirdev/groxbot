export type KnowledgeGraphSnapshot = {
  paths: string[];
  out: number[][];
};

export type KnowledgeGraphIndex = KnowledgeGraphSnapshot & {
  byPath: Map<string, number>;
  incoming: number[][];
};

export type KnowledgeGraphNode = {
  id: number;
  path: string;
  x: number;
  y: number;
  label: string;
};

export type KnowledgeGraphLayout = {
  nodes: KnowledgeGraphNode[];
  edges: { from: number; to: number }[];
  width: number;
  height: number;
};

/** Invert outgoing ints once. Browser holds this for the modal session. */
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

export function knowledgeGraphLinkedIds(
  index: KnowledgeGraphIndex,
  path: string,
): Set<number> {
  const id = index.byPath.get(path);
  const linked = new Set<number>();
  if (id == null) return linked;
  linked.add(id);
  for (const to of index.out[id] ?? []) linked.add(to);
  for (const from of index.incoming[id] ?? []) linked.add(from);
  return linked;
}

export function graphNodeLabel(path: string): string {
  return path.split("/").filter(Boolean).at(-1) || path;
}

export function layoutKnowledgeGraph(
  snap: KnowledgeGraphSnapshot,
): KnowledgeGraphLayout {
  const n = snap.paths.length;
  const components = undirectedComponents(n, snap.out);
  const placed: KnowledgeGraphNode[] = [];
  let cursorX = 48;
  let cursorY = 48;
  let rowH = 0;
  const rowMax = 640;
  const gap = 56;

  for (const group of components) {
    const radius = group.length <= 1 ? 0 : Math.max(56, group.length * 22);
    const size = Math.max(96, radius * 2 + 48);
    if (cursorX > 48 && cursorX + size > rowMax) {
      cursorX = 48;
      cursorY += rowH + gap;
      rowH = 0;
    }
    const cx = cursorX + size / 2;
    const cy = cursorY + size / 2;
    for (let i = 0; i < group.length; i++) {
      const id = group[i] ?? 0;
      const angle =
        group.length === 1
          ? 0
          : (Math.PI * 2 * i) / group.length - Math.PI / 2;
      const path = snap.paths[id] ?? "";
      placed[id] = {
        id,
        path,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        label: graphNodeLabel(path),
      };
    }
    cursorX += size + gap;
    rowH = Math.max(rowH, size);
  }

  const edges: { from: number; to: number }[] = [];
  for (let from = 0; from < snap.out.length; from++) {
    for (const to of snap.out[from] ?? []) {
      if (to >= 0 && to < n) edges.push({ from, to });
    }
  }

  let maxX = 160;
  let maxY = 120;
  for (const node of placed) {
    if (!node) continue;
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  }
  return {
    nodes: placed.filter(Boolean),
    edges,
    width: maxX + 80,
    height: maxY + 64,
  };
}

function undirectedComponents(n: number, out: number[][]): number[][] {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let from = 0; from < out.length; from++) {
    for (const to of out[from] ?? []) {
      if (to < 0 || to >= n || to === from) continue;
      adj[from]?.push(to);
      adj[to]?.push(from);
    }
  }
  const seen = new Uint8Array(n);
  const groups: number[][] = [];
  for (let start = 0; start < n; start++) {
    if (seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    const group: number[] = [];
    while (stack.length > 0) {
      const id = stack.pop() ?? 0;
      group.push(id);
      for (const next of adj[id] ?? []) {
        if (seen[next]) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    group.sort((a, b) => a - b);
    groups.push(group);
  }
  return groups;
}
