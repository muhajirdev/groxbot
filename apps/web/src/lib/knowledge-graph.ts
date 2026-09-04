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
  folder: string;
  hue: number;
  degree: number;
  isolate: boolean;
};

export type KnowledgeGraphEdge = {
  from: number;
  to: number;
  reciprocal: boolean;
};

export type KnowledgeGraphLayout = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  width: number;
  height: number;
};

export type GraphSim = {
  n: number;
  x: Float64Array;
  y: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  pin: Int8Array;
  active: Int8Array;
  degree: Float64Array;
  alpha: number;
  alphaTarget: number;
  rest: number;
  charge: number;
  cx: number;
  cy: number;
  edges: { from: number; to: number }[];
};

/** d3-force defaults: cool over ~300 ticks, keep 60% of velocity. */
const ALPHA_MIN = 0.001;
const ALPHA_DECAY = 1 - 0.001 ** (1 / 300);
const VELOCITY_KEEP = 0.6;
const LINK_ITERATIONS = 3;
const CENTER_STRENGTH = 0.06;

export type GraphCamera = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type GraphLabelBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const EMPTY_SIZE = { width: 720, height: 480 };
export const KNOWLEDGE_GRAPH_REST = 118;
export const GRAPH_ZOOM_MIN = 0.22;
export const GRAPH_ZOOM_MAX = 3.6;

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

/** Hover wins over selection. Empty when the graph is at rest. */
export function knowledgeGraphFocusIds(
  index: KnowledgeGraphIndex,
  hover: string | null,
  selected: string | null,
): Set<number> {
  const path = hover ?? selected;
  if (!path) return new Set();
  return knowledgeGraphLinkedIds(index, path);
}

export function graphNodeLabel(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.at(-1) || path;
}

export function graphFolder(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length > 1 ? (parts[0] ?? "") : "";
}

export function graphFolderHue(folder: string): number {
  if (!folder) return 215;
  let hash = 2166136261;
  for (let i = 0; i < folder.length; i++) {
    hash ^= folder.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 360;
}

export function clampGraphZoom(k: number): number {
  return Math.min(GRAPH_ZOOM_MAX, Math.max(GRAPH_ZOOM_MIN, k));
}

export function graphCameraScale(
  camera: GraphCamera,
  viewport: { width: number; height: number },
): number {
  if (camera.w <= 0) return 1;
  return viewport.width / camera.w;
}

/** Screen-space transform for a world group. Pan/zoom should set this, not viewBox. */
export function graphWorldTransform(
  camera: GraphCamera,
  viewport: { width: number; height: number },
): string {
  const k = graphCameraScale(camera, viewport);
  return `translate(${-camera.x * k} ${-camera.y * k}) scale(${k})`;
}

export function worldFromScreen(
  camera: GraphCamera,
  screen: { x: number; y: number },
  viewport: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: camera.x + (screen.x / Math.max(1, viewport.width)) * camera.w,
    y: camera.y + (screen.y / Math.max(1, viewport.height)) * camera.h,
  };
}

export function zoomGraphCamera(
  camera: GraphCamera,
  world: { x: number; y: number },
  factor: number,
  viewport: { width: number; height: number },
): GraphCamera {
  const k = clampGraphZoom(graphCameraScale(camera, viewport) * factor);
  const w = viewport.width / k;
  const h = viewport.height / k;
  const fx = camera.w <= 0 ? 0.5 : (world.x - camera.x) / camera.w;
  const fy = camera.h <= 0 ? 0.5 : (world.y - camera.y) / camera.h;
  return {
    w,
    h,
    x: world.x - fx * w,
    y: world.y - fy * h,
  };
}

export function panGraphCamera(
  camera: GraphCamera,
  dx: number,
  dy: number,
  viewport: { width: number; height: number },
): GraphCamera {
  return {
    ...camera,
    x: camera.x - (dx / Math.max(1, viewport.width)) * camera.w,
    y: camera.y - (dy / Math.max(1, viewport.height)) * camera.h,
  };
}

export function fitGraphCamera(
  nodes: { x: number; y: number; r: number }[],
  viewport: { width: number; height: number },
  padding = 36,
): GraphCamera {
  if (nodes.length === 0 || viewport.width < 8 || viewport.height < 8) {
    return {
      x: 0,
      y: 0,
      w: viewport.width || 720,
      h: viewport.height || 480,
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.r);
    minY = Math.min(minY, node.y - node.r);
    maxX = Math.max(maxX, node.x + node.r);
    maxY = Math.max(maxY, node.y + node.r + 18);
  }
  let w = Math.max(1, maxX - minX + padding * 2);
  let h = Math.max(1, maxY - minY + padding * 2);
  const aspect = viewport.width / viewport.height;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
  };
}

export function graphLabelBox(
  node: {
    x: number;
    y: number;
    r: number;
    label: string;
  },
  zoom = 1,
): GraphLabelBox {
  const k = Math.max(0.5, zoom);
  const w = Math.max(28, node.label.length * 6.4) / k;
  return {
    x: node.x - w / 2,
    y: node.y + node.r + 2,
    w,
    h: 14 / k,
  };
}

function boxesOverlap(a: GraphLabelBox, b: GraphLabelBox): boolean {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

/** Greedy labels: always-on first, then highest degree that still fits. */
export function pickGraphLabels(
  nodes: {
    id: number;
    x: number;
    y: number;
    r: number;
    label: string;
    degree: number;
  }[],
  always: ReadonlySet<number>,
  limit = 52,
  zoom = 1,
): Set<number> {
  const shown = new Set<number>(always);
  const boxes: GraphLabelBox[] = [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const id of always) {
    const node = byId.get(id);
    if (node) boxes.push(graphLabelBox(node, zoom));
  }
  const ranked = [...nodes].sort((a, b) => b.degree - a.degree || a.id - b.id);
  for (const node of ranked) {
    if (shown.has(node.id)) continue;
    if (shown.size >= limit) break;
    const box = graphLabelBox(node, zoom);
    if (boxes.some((other) => boxesOverlap(other, box))) continue;
    shown.add(node.id);
    boxes.push(box);
  }
  return shown;
}

export function graphEdgeGeom(
  from: { x: number; y: number; r: number },
  to: { x: number; y: number; r: number },
): { d: string } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = from.x + ux * (from.r + 1.2);
  const y1 = from.y + uy * (from.r + 1.2);
  const x2 = to.x - ux * (to.r + 1.2);
  const y2 = to.y - uy * (to.r + 1.2);
  return {
    d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`,
  };
}

export function layoutKnowledgeGraph(
  snap: KnowledgeGraphSnapshot,
): KnowledgeGraphLayout {
  const n = snap.paths.length;
  const pair = new Map<string, KnowledgeGraphEdge>();
  for (let from = 0; from < snap.out.length; from++) {
    for (const to of snap.out[from] ?? []) {
      if (to < 0 || to >= n || to === from) continue;
      const a = Math.min(from, to);
      const b = Math.max(from, to);
      const key = `${a}:${b}`;
      const existing = pair.get(key);
      if (existing) {
        if (existing.from !== from) existing.reciprocal = true;
        continue;
      }
      pair.set(key, { from, to, reciprocal: false });
    }
  }
  const edges = [...pair.values()];
  if (n === 0) {
    return { nodes: [], edges: [], ...EMPTY_SIZE };
  }

  const degree = new Float64Array(n);
  for (const edge of edges) {
    degree[edge.from] = (degree[edge.from] ?? 0) + 1;
    degree[edge.to] = (degree[edge.to] ?? 0) + 1;
    if (edge.reciprocal) {
      degree[edge.from] = (degree[edge.from] ?? 0) + 1;
      degree[edge.to] = (degree[edge.to] ?? 0) + 1;
    }
  }

  const isolates: number[] = [];
  const linked: number[] = [];
  for (let id = 0; id < n; id++) {
    if ((degree[id] ?? 0) === 0) isolates.push(id);
    else linked.push(id);
  }

  const placed: KnowledgeGraphNode[] = new Array(n);
  let cursorX = 72;
  let cursorY = 72;
  let rowH = 0;
  const rowMax = 920;
  const gap = 88;

  const components = undirectedComponents(linked, snap.out);
  components.sort((a, b) => b.length - a.length);

  for (const group of components) {
    const local = forceComponent(group, edges, snap.paths);
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
    const pad = 36;
    const sizeW = Math.max(96, maxX - minX + pad * 2);
    const sizeH = Math.max(96, maxY - minY + pad * 2);
    if (cursorX > 72 && cursorX + sizeW > rowMax) {
      cursorX = 72;
      cursorY += rowH + gap;
      rowH = 0;
    }
    const ox = cursorX + pad - minX;
    const oy = cursorY + pad - minY;
    for (const id of group) {
      placed[id] = makeNode(
        snap,
        id,
        local.get(id),
        ox,
        oy,
        degree[id] ?? 0,
        false,
      );
    }
    cursorX += sizeW + gap;
    rowH = Math.max(rowH, sizeH);
  }

  if (isolates.length > 0) {
    if (linked.length > 0) {
      cursorX = 72;
      cursorY += rowH + gap;
    }
    const cell = 56;
    const cols = Math.max(
      1,
      Math.min(12, Math.ceil(Math.sqrt(isolates.length * 1.6))),
    );
    for (let i = 0; i < isolates.length; i++) {
      const id = isolates[i] ?? i;
      const col = i % cols;
      const row = Math.floor(i / cols);
      placed[id] = makeNode(
        snap,
        id,
        { x: col * cell, y: row * cell },
        cursorX,
        cursorY,
        0,
        true,
      );
    }
  }

  const nodes = placed.filter(Boolean);
  expandConnectedNodes(nodes);

  let width = EMPTY_SIZE.width;
  let height = EMPTY_SIZE.height;
  for (const node of nodes) {
    width = Math.max(width, node.x + 80);
    height = Math.max(height, node.y + 56);
  }
  return {
    nodes,
    edges,
    width,
    height,
  };
}

function expandConnectedNodes(
  nodes: KnowledgeGraphNode[],
  minW = 820,
  minH = 300,
) {
  const linked = nodes.filter((node) => !node.isolate);
  if (linked.length < 2) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of linked) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  }
  let spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const targetAspect = minW / minH;
  const aspect = spanX / spanY;
  if (aspect < targetAspect) {
    const stretch = targetAspect / aspect;
    for (const node of linked) {
      node.x = cx + (node.x - cx) * stretch;
    }
    spanX *= stretch;
  }
  const scale = Math.max(minW / spanX, minH / spanY, 1);
  if (scale === 1) return;
  for (const node of linked) {
    node.x = cx + (node.x - cx) * scale;
    node.y = cy + (node.y - cy) * scale;
  }
}

function makeNode(
  snap: KnowledgeGraphSnapshot,
  id: number,
  pos: { x: number; y: number } | undefined,
  ox: number,
  oy: number,
  degree: number,
  isolate: boolean,
): KnowledgeGraphNode {
  const path = snap.paths[id] ?? "";
  const folder = graphFolder(path);
  return {
    id,
    path,
    x: (pos?.x ?? 0) + ox,
    y: (pos?.y ?? 0) + oy,
    r: isolate ? 3.4 : 4.2 + Math.min(8.5, Math.sqrt(degree) * 2.4),
    label: graphNodeLabel(path),
    folder,
    hue: graphFolderHue(folder),
    degree,
    isolate,
  };
}

function forceComponent(
  ids: number[],
  edges: KnowledgeGraphEdge[],
  paths: string[],
): Map<number, { x: number; y: number }> {
  const k = ids.length;
  const at = new Map<number, number>();
  for (let i = 0; i < k; i++) at.set(ids[i] ?? i, i);
  const x = new Float64Array(k);
  const y = new Float64Array(k);
  const vx = new Float64Array(k);
  const vy = new Float64Array(k);
  const localEdges: { from: number; to: number; reciprocal: boolean }[] = [];
  for (const edge of edges) {
    const from = at.get(edge.from);
    const to = at.get(edge.to);
    if (from == null || to == null || from === to) continue;
    localEdges.push({ from, to, reciprocal: edge.reciprocal });
  }

  const folders = ids.map((id) => graphFolder(paths[id] ?? ""));
  const span = Math.max(88, Math.sqrt(k) * 48);
  for (let i = 0; i < k; i++) {
    const t = i + 0.5;
    const radius = Math.sqrt(t / k) * span;
    const angle = t * 2.399963229728653;
    x[i] = radius * Math.cos(angle);
    y[i] = radius * Math.sin(angle);
  }

  const ticks = k > 240 ? 64 : k > 80 ? 110 : 180;
  const rest = KNOWLEDGE_GRAPH_REST + Math.min(36, Math.sqrt(k) * 2);
  const spring = 0.05;
  const damp = 0.88;
  const allPairs = k <= 180;

  for (let tick = 0; tick < ticks; tick++) {
    const cool = 1 - tick / (ticks + 8);
    const repulsion = (k > 240 ? 280 : k > 80 ? 560 : 920) * cool;
    if (allPairs) {
      applyAllPairsRepulsion(x, y, vx, vy, k, repulsion);
    } else {
      applyGridRepulsion(x, y, vx, vy, k, Math.max(28, rest * 0.85), repulsion);
    }
    for (const edge of localEdges) {
      const dx = (x[edge.to] ?? 0) - (x[edge.from] ?? 0);
      const dy = (y[edge.to] ?? 0) - (y[edge.from] ?? 0);
      const d = Math.hypot(dx, dy) || 0.01;
      const target = edge.reciprocal ? rest * 0.92 : rest;
      const pull = (d - target) * spring;
      const fx = (dx / d) * pull;
      const fy = (dy / d) * pull;
      vx[edge.from] = (vx[edge.from] ?? 0) + fx;
      vy[edge.from] = (vy[edge.from] ?? 0) + fy;
      vx[edge.to] = (vx[edge.to] ?? 0) - fx;
      vy[edge.to] = (vy[edge.to] ?? 0) - fy;
    }

    const centroids = folderCentroids(folders, x, y);
    for (let i = 0; i < k; i++) {
      const folder = folders[i] ?? "";
      const center = centroids.get(folder);
      if (center && folder) {
        vx[i] = (vx[i] ?? 0) + (center.x - (x[i] ?? 0)) * 0.006;
        vy[i] = (vy[i] ?? 0) + (center.y - (y[i] ?? 0)) * 0.006;
      }
      vx[i] = (vx[i] ?? 0) - (x[i] ?? 0) * 0.0035;
      vy[i] = (vy[i] ?? 0) - (y[i] ?? 0) * 0.0035;
      vx[i] = (vx[i] ?? 0) * damp;
      vy[i] = (vy[i] ?? 0) * damp;
      x[i] = (x[i] ?? 0) + (vx[i] ?? 0);
      y[i] = (y[i] ?? 0) + (vy[i] ?? 0);
    }
    separateNodes(x, y, k, 34);
  }

  const out = new Map<number, { x: number; y: number }>();
  for (let i = 0; i < k; i++) {
    out.set(ids[i] ?? i, { x: x[i] ?? 0, y: y[i] ?? 0 });
  }
  return out;
}

function folderCentroids(
  folders: string[],
  x: Float64Array,
  y: Float64Array,
): Map<string, { x: number; y: number }> {
  const sum = new Map<string, { x: number; y: number; n: number }>();
  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i] ?? "";
    const cur = sum.get(folder) ?? { x: 0, y: 0, n: 0 };
    cur.x += x[i] ?? 0;
    cur.y += y[i] ?? 0;
    cur.n += 1;
    sum.set(folder, cur);
  }
  const out = new Map<string, { x: number; y: number }>();
  for (const [folder, cur] of sum) {
    out.set(folder, { x: cur.x / cur.n, y: cur.y / cur.n });
  }
  return out;
}

function applyCharge(
  x: Float64Array,
  y: Float64Array,
  vx: Float64Array,
  vy: Float64Array,
  activeIds: number[],
  k: number,
  max2: number,
) {
  const n = activeIds.length;
  if (n <= 220) {
    for (let a = 0; a < n; a++) {
      const i = activeIds[a];
      if (i == null) continue;
      for (let b = a + 1; b < n; b++) {
        const j = activeIds[b];
        if (j == null) continue;
        pushCharge(x, y, vx, vy, i, j, k, max2);
      }
    }
    return;
  }
  const cell = Math.max(48, Math.sqrt(max2) / 8);
  const buckets = new Map<number, number[]>();
  const keyAt = (cx: number, cy: number) => cx * 1_000_003 + cy;
  for (const i of activeIds) {
    const cx = Math.floor((x[i] ?? 0) / cell);
    const cy = Math.floor((y[i] ?? 0) / cell);
    const key = keyAt(cx, cy);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(i);
    else buckets.set(key, [i]);
  }
  for (const i of activeIds) {
    const cx = Math.floor((x[i] ?? 0) / cell);
    const cy = Math.floor((y[i] ?? 0) / cell);
    for (let ox = -2; ox <= 2; ox++) {
      for (let oy = -2; oy <= 2; oy++) {
        const bucket = buckets.get(keyAt(cx + ox, cy + oy));
        if (!bucket) continue;
        for (const j of bucket) {
          if (j <= i) continue;
          pushCharge(x, y, vx, vy, i, j, k, max2);
        }
      }
    }
  }
}

function pushCharge(
  x: Float64Array,
  y: Float64Array,
  vx: Float64Array,
  vy: Float64Array,
  i: number,
  j: number,
  k: number,
  max2: number,
) {
  const dx = (x[j] ?? 0) - (x[i] ?? 0);
  const dy = (y[j] ?? 0) - (y[i] ?? 0);
  let d2 = dx * dx + dy * dy;
  if (d2 > max2 || d2 < 1e-8) return;
  if (d2 < 16) d2 = 16;
  const w = k / d2;
  vx[i] = (vx[i] ?? 0) + dx * w;
  vy[i] = (vy[i] ?? 0) + dy * w;
  vx[j] = (vx[j] ?? 0) - dx * w;
  vy[j] = (vy[j] ?? 0) - dy * w;
}

function applyAllPairsRepulsion(
  x: Float64Array,
  y: Float64Array,
  vx: Float64Array,
  vy: Float64Array,
  k: number,
  repulsion: number,
) {
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      pushPair(x, y, vx, vy, i, j, repulsion);
    }
  }
}

function applyGridRepulsion(
  x: Float64Array,
  y: Float64Array,
  vx: Float64Array,
  vy: Float64Array,
  k: number,
  cell: number,
  repulsion: number,
) {
  const buckets = new Map<number, number[]>();
  const keyAt = (cx: number, cy: number) => cx * 1_000_003 + cy;
  for (let i = 0; i < k; i++) {
    const cx = Math.floor((x[i] ?? 0) / cell);
    const cy = Math.floor((y[i] ?? 0) / cell);
    const key = keyAt(cx, cy);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(i);
    else buckets.set(key, [i]);
  }
  for (let i = 0; i < k; i++) {
    const cx = Math.floor((x[i] ?? 0) / cell);
    const cy = Math.floor((y[i] ?? 0) / cell);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const bucket = buckets.get(keyAt(cx + ox, cy + oy));
        if (!bucket) continue;
        for (const j of bucket) {
          if (j <= i) continue;
          pushPair(x, y, vx, vy, i, j, repulsion);
        }
      }
    }
  }
}

function pushPair(
  x: Float64Array,
  y: Float64Array,
  vx: Float64Array,
  vy: Float64Array,
  i: number,
  j: number,
  repulsion: number,
) {
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

function separateNodes(
  x: Float64Array,
  y: Float64Array,
  k: number,
  minDist: number,
) {
  const min2 = minDist * minDist;
  const cap = k <= 180 ? k : Math.min(k, 220);
  for (let i = 0; i < cap; i++) {
    const jMax = k <= 180 ? k : Math.min(k, i + 24);
    for (let j = i + 1; j < jMax; j++) {
      const dx = (x[i] ?? 0) - (x[j] ?? 0);
      const dy = (y[i] ?? 0) - (y[j] ?? 0);
      const d2 = dx * dx + dy * dy;
      if (d2 >= min2 || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = ((minDist - d) / d) * 0.5;
      x[i] = (x[i] ?? 0) + dx * push;
      y[i] = (y[i] ?? 0) + dy * push;
      x[j] = (x[j] ?? 0) - dx * push;
      y[j] = (y[j] ?? 0) - dy * push;
    }
  }
}

function undirectedComponents(ids: number[], out: number[][]): number[][] {
  if (ids.length === 0) return [];
  const allowed = new Set(ids);
  const adj = new Map<number, number[]>();
  for (const id of ids) adj.set(id, []);
  for (const from of ids) {
    for (const to of out[from] ?? []) {
      if (!allowed.has(to) || to === from) continue;
      adj.get(from)?.push(to);
      adj.get(to)?.push(from);
    }
  }
  const seen = new Set<number>();
  const groups: number[][] = [];
  for (const start of ids) {
    if (seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    const group: number[] = [];
    while (stack.length > 0) {
      const id = stack.pop() ?? 0;
      group.push(id);
      for (const next of adj.get(id) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    group.sort((a, b) => a - b);
    groups.push(group);
  }
  return groups;
}

export function createGraphSim(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
): GraphSim {
  const n = nodes.reduce((max, node) => Math.max(max, node.id + 1), 0);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);
  const pin = new Int8Array(n);
  const active = new Int8Array(n);
  const degree = new Float64Array(n);
  let cx = 0;
  let cy = 0;
  let live = 0;
  for (const node of nodes) {
    x[node.id] = node.x;
    y[node.id] = node.y;
    if (!node.isolate) {
      active[node.id] = 1;
      cx += node.x;
      cy += node.y;
      live += 1;
    }
  }
  if (live > 0) {
    cx /= live;
    cy /= live;
  }
  const simEdges = edges.map((edge) => {
    degree[edge.from] = (degree[edge.from] ?? 0) + 1;
    degree[edge.to] = (degree[edge.to] ?? 0) + 1;
    return { from: edge.from, to: edge.to };
  });
  let restSum = 0;
  for (const edge of simEdges) {
    restSum += Math.hypot(
      (x[edge.to] ?? 0) - (x[edge.from] ?? 0),
      (y[edge.to] ?? 0) - (y[edge.from] ?? 0),
    );
  }
  const rest =
    simEdges.length > 0
      ? Math.min(240, Math.max(72, restSum / simEdges.length))
      : KNOWLEDGE_GRAPH_REST;
  return {
    n,
    x,
    y,
    vx,
    vy,
    pin,
    active,
    degree,
    alpha: 0.2,
    alphaTarget: 0,
    rest,
    charge: -rest * 5,
    cx,
    cy,
    edges: simEdges,
  };
}

export function pinGraphNode(
  sim: GraphSim,
  id: number,
  x: number,
  y: number,
) {
  if (id < 0 || id >= sim.n) return;
  sim.pin[id] = 1;
  sim.x[id] = x;
  sim.y[id] = y;
  sim.vx[id] = 0;
  sim.vy[id] = 0;
}

export function unpinGraphNode(sim: GraphSim, id: number) {
  if (id < 0 || id >= sim.n) return;
  sim.pin[id] = 0;
}

export function setGraphSimTarget(sim: GraphSim, target: number) {
  sim.alphaTarget = Math.min(1, Math.max(0, target));
  if (sim.alphaTarget > sim.alpha) sim.alpha = sim.alphaTarget;
}

export function heatGraphSim(sim: GraphSim, amount = 0.4) {
  sim.alpha = Math.min(1, Math.max(sim.alpha, 0) + amount);
}

export function applySimNodes(
  sim: GraphSim,
  nodes: KnowledgeGraphNode[],
): KnowledgeGraphNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    const x = sim.x[node.id] ?? node.x;
    const y = sim.y[node.id] ?? node.y;
    if (x === node.x && y === node.y) return node;
    changed = true;
    return { ...node, x, y };
  });
  return changed ? next : nodes;
}

export function graphSimAwake(sim: GraphSim): boolean {
  return sim.alpha > ALPHA_MIN || sim.alphaTarget > ALPHA_MIN;
}

/** One live tick. Same model as Obsidian / d3-force. */
export function stepGraphSim(sim: GraphSim): boolean {
  if (sim.n === 0) return false;
  sim.alpha += (sim.alphaTarget - sim.alpha) * ALPHA_DECAY;
  const alpha = sim.alpha;
  const activeIds: number[] = [];
  let pinned = false;
  for (let i = 0; i < sim.n; i++) {
    if (sim.active[i]) activeIds.push(i);
    if (sim.pin[i]) pinned = true;
  }

  applyCharge(
    sim.x,
    sim.y,
    sim.vx,
    sim.vy,
    activeIds,
    sim.charge * alpha,
    sim.rest * sim.rest * 64,
  );

  const rest = sim.rest;
  for (let pass = 0; pass < LINK_ITERATIONS; pass++) {
    for (const edge of sim.edges) {
      if (!sim.active[edge.from] || !sim.active[edge.to]) continue;
      const degFrom = Math.max(1, sim.degree[edge.from] ?? 1);
      const degTo = Math.max(1, sim.degree[edge.to] ?? 1);
      const strength = 0.9 / Math.min(degFrom, degTo);
      const dx =
        (sim.x[edge.to] ?? 0) +
        (sim.vx[edge.to] ?? 0) -
        ((sim.x[edge.from] ?? 0) + (sim.vx[edge.from] ?? 0));
      const dy =
        (sim.y[edge.to] ?? 0) +
        (sim.vy[edge.to] ?? 0) -
        ((sim.y[edge.from] ?? 0) + (sim.vy[edge.from] ?? 0));
      const d = Math.hypot(dx, dy) || 0.01;
      const l = ((d - rest) / d) * alpha * strength;
      const b = degFrom / (degFrom + degTo);
      const fx = dx * l;
      const fy = dy * l;
      if (!sim.pin[edge.to]) {
        sim.vx[edge.to] = (sim.vx[edge.to] ?? 0) - fx * b;
        sim.vy[edge.to] = (sim.vy[edge.to] ?? 0) - fy * b;
      }
      if (!sim.pin[edge.from]) {
        sim.vx[edge.from] = (sim.vx[edge.from] ?? 0) + fx * (1 - b);
        sim.vy[edge.from] = (sim.vy[edge.from] ?? 0) + fy * (1 - b);
      }
    }
  }

  let moving = false;
  for (const i of activeIds) {
    if (sim.pin[i]) {
      sim.vx[i] = 0;
      sim.vy[i] = 0;
      continue;
    }
    sim.vx[i] = (sim.vx[i] ?? 0) * VELOCITY_KEEP;
    sim.vy[i] = (sim.vy[i] ?? 0) * VELOCITY_KEEP;
    sim.x[i] = (sim.x[i] ?? 0) + (sim.vx[i] ?? 0);
    sim.y[i] = (sim.y[i] ?? 0) + (sim.vy[i] ?? 0);
    if (Math.abs(sim.vx[i] ?? 0) + Math.abs(sim.vy[i] ?? 0) > 0.04) moving = true;
  }

  if (!pinned && activeIds.length > 0) {
    let mx = 0;
    let my = 0;
    for (const i of activeIds) {
      mx += sim.x[i] ?? 0;
      my += sim.y[i] ?? 0;
    }
    mx = (mx / activeIds.length - sim.cx) * CENTER_STRENGTH;
    my = (my / activeIds.length - sim.cy) * CENTER_STRENGTH;
    if (mx !== 0 || my !== 0) {
      for (const i of activeIds) {
        if (sim.pin[i]) continue;
        sim.x[i] = (sim.x[i] ?? 0) - mx;
        sim.y[i] = (sim.y[i] ?? 0) - my;
      }
    }
  }

  return moving || graphSimAwake(sim);
}

export function graphZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.0016);
}
