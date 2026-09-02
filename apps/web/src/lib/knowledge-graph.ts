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
  r: number;
  label: string;
};

export type KnowledgeGraphLayout = {
  nodes: KnowledgeGraphNode[];
  edges: { from: number; to: number }[];
  width: number;
  height: number;
};

const EMPTY_SIZE = { width: 720, height: 480 };
export const KNOWLEDGE_GRAPH_REST = 86;

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
  const edges: { from: number; to: number }[] = [];
  for (let from = 0; from < snap.out.length; from++) {
    for (const to of snap.out[from] ?? []) {
      if (to >= 0 && to < n && to !== from) edges.push({ from, to });
    }
  }
  if (n === 0) {
    return { nodes: [], edges: [], ...EMPTY_SIZE };
  }

  const degree = new Float64Array(n);
  for (const edge of edges) {
    degree[edge.from] += 1;
    degree[edge.to] += 1;
  }

  const components = undirectedComponents(n, snap.out);
  const placed: KnowledgeGraphNode[] = [];
  let cursorX = 56;
  let cursorY = 56;
  let rowH = 0;
  const rowMax = 780;
  const gap = 72;

  for (const group of components) {
    const local = forceComponent(group, edges);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of group) {
      const pos = local.get(id);
      if (!pos) continue;
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
    }
    if (!Number.isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = 0;
      maxY = 0;
    }
    const pad = 28;
    const sizeW = Math.max(72, maxX - minX + pad * 2);
    const sizeH = Math.max(72, maxY - minY + pad * 2);
    if (cursorX > 56 && cursorX + sizeW > rowMax) {
      cursorX = 56;
      cursorY += rowH + gap;
      rowH = 0;
    }
    const ox = cursorX + pad - minX;
    const oy = cursorY + pad - minY;
    for (const id of group) {
      const pos = local.get(id);
      const path = snap.paths[id] ?? "";
      placed[id] = {
        id,
        path,
        x: (pos?.x ?? 0) + ox,
        y: (pos?.y ?? 0) + oy,
        r: 3.6 + Math.min(5.5, Math.sqrt(degree[id] ?? 0) * 1.6),
        label: graphNodeLabel(path),
      };
    }
    cursorX += sizeW + gap;
    rowH = Math.max(rowH, sizeH);
  }

  let width = EMPTY_SIZE.width;
  let height = EMPTY_SIZE.height;
  for (const node of placed) {
    if (!node) continue;
    width = Math.max(width, node.x + 64);
    height = Math.max(height, node.y + 48);
  }
  return {
    nodes: placed.filter(Boolean),
    edges,
    width,
    height,
  };
}

function forceComponent(
  ids: number[],
  edges: { from: number; to: number }[],
): Map<number, { x: number; y: number }> {
  const k = ids.length;
  const at = new Map<number, number>();
  for (let i = 0; i < k; i++) at.set(ids[i] ?? i, i);
  const x = new Float64Array(k);
  const y = new Float64Array(k);
  const vx = new Float64Array(k);
  const vy = new Float64Array(k);
  const localEdges: { from: number; to: number }[] = [];
  for (const edge of edges) {
    const from = at.get(edge.from);
    const to = at.get(edge.to);
    if (from == null || to == null || from === to) continue;
    localEdges.push({ from, to });
  }

  const span = Math.max(48, Math.sqrt(k) * 28);
  for (let i = 0; i < k; i++) {
    const t = i + 0.5;
    const radius = Math.sqrt(t / k) * span;
    const angle = t * 2.399963229728653;
    x[i] = radius * Math.cos(angle);
    y[i] = radius * Math.sin(angle);
  }

  const ticks = k > 200 ? 48 : k > 60 ? 90 : 140;
  const repulsion = k > 200 ? 140 : 380;
  const spring = 0.07;
  const damp = 0.84;
  const allPairs = k <= 220;

  for (let tick = 0; tick < ticks; tick++) {
    if (allPairs) {
      for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
          let dx = (x[i] ?? 0) - (x[j] ?? 0);
          let dy = (y[i] ?? 0) - (y[j] ?? 0);
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.04) d2 = 0.04;
          const inv = 1 / Math.sqrt(d2);
          const f = repulsion / d2;
          dx *= inv * f;
          dy *= inv * f;
          vx[i] = (vx[i] ?? 0) + dx;
          vy[i] = (vy[i] ?? 0) + dy;
          vx[j] = (vx[j] ?? 0) - dx;
          vy[j] = (vy[j] ?? 0) - dy;
        }
      }
    }
    for (const edge of localEdges) {
      const dx = (x[edge.to] ?? 0) - (x[edge.from] ?? 0);
      const dy = (y[edge.to] ?? 0) - (y[edge.from] ?? 0);
      const d = Math.hypot(dx, dy) || 0.01;
      const pull = (d - KNOWLEDGE_GRAPH_REST) * spring;
      const fx = (dx / d) * pull;
      const fy = (dy / d) * pull;
      vx[edge.from] = (vx[edge.from] ?? 0) + fx;
      vy[edge.from] = (vy[edge.from] ?? 0) + fy;
      vx[edge.to] = (vx[edge.to] ?? 0) - fx;
      vy[edge.to] = (vy[edge.to] ?? 0) - fy;
    }
    for (let i = 0; i < k; i++) {
      vx[i] = (vx[i] ?? 0) * damp;
      vy[i] = (vy[i] ?? 0) * damp;
      x[i] = (x[i] ?? 0) + (vx[i] ?? 0);
      y[i] = (y[i] ?? 0) + (vy[i] ?? 0);
    }
  }

  const out = new Map<number, { x: number; y: number }>();
  for (let i = 0; i < k; i++) {
    out.set(ids[i] ?? i, { x: x[i] ?? 0, y: y[i] ?? 0 });
  }
  return out;
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
