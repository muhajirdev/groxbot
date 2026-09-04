import { describe, expect, it } from "vitest";
import {
  createGraphSim,
  fitGraphCamera,
  graphEdgeGeom,
  graphFolder,
  graphFolderHue,
  graphNodeLabel,
  graphZoomFactor,
  indexKnowledgeGraph,
  knowledgeGraphBacklinks,
  knowledgeGraphFocusIds,
  knowledgeGraphLinkedIds,
  layoutKnowledgeGraph,
  pickGraphLabels,
  pinGraphNode,
  setGraphSimTarget,
  stepGraphSim,
  worldFromScreen,
  graphWorldTransform,
  zoomGraphCamera,
} from "./knowledge-graph";

const snap = {
  paths: [
    "for/example/this-file.md",
    "how-we-work/constraints.md",
    "playbooks/weekly-update/SKILL.md",
    "orphan.md",
  ],
  out: [[1], [], [1, 0], []],
};

describe("indexKnowledgeGraph", () => {
  it("inverts once and answers backlinks without scanning", () => {
    const index = indexKnowledgeGraph(snap);
    expect(
      knowledgeGraphBacklinks(index, "how-we-work/constraints.md"),
    ).toEqual(["for/example/this-file.md", "playbooks/weekly-update/SKILL.md"]);
    expect(knowledgeGraphBacklinks(index, "orphan.md")).toEqual([]);
    expect(knowledgeGraphLinkedIds(index, "for/example/this-file.md")).toEqual(
      new Set([0, 1, 2]),
    );
    expect(
      knowledgeGraphFocusIds(index, "orphan.md", "for/example/this-file.md"),
    ).toEqual(new Set([3]));
    expect(knowledgeGraphFocusIds(index, null, null).size).toBe(0);
  });
});

describe("graph labels", () => {
  it("uses the filename, including .md", () => {
    expect(graphNodeLabel("playbooks/weekly-update/SKILL.md")).toBe("SKILL.md");
    expect(graphNodeLabel("playbooks/SKILL.md")).toBe("SKILL.md");
    expect(graphNodeLabel("notes/clients.md")).toBe("clients.md");
    expect(graphFolder("notes/clients.md")).toBe("notes");
    expect(graphFolder("orphan.md")).toBe("");
  });

  it("keeps folder hues stable", () => {
    expect(graphFolderHue("playbooks")).toBe(graphFolderHue("playbooks"));
    expect(graphFolderHue("playbooks")).not.toBe(graphFolderHue("notes"));
  });

  it("keeps selected labels and prefers hubs when they would overlap", () => {
    const shown = pickGraphLabels(
      [
        { id: 0, x: 0, y: 0, r: 6, label: "hub", degree: 8 },
        { id: 1, x: 2, y: 0, r: 6, label: "leaf", degree: 1 },
        { id: 2, x: 240, y: 0, r: 6, label: "far", degree: 2 },
      ],
      new Set([1]),
    );
    expect(shown.has(1)).toBe(true);
    expect(shown.has(2)).toBe(true);
    expect(shown.has(0)).toBe(false);
  });
});

describe("graph camera", () => {
  it("fits nodes inside the viewport", () => {
    const viewport = { width: 400, height: 300 };
    const camera = fitGraphCamera(
      [
        { x: 0, y: 0, r: 8 },
        { x: 200, y: 80, r: 8 },
      ],
      viewport,
    );
    const left = worldFromScreen(camera, { x: 0, y: 0 }, viewport);
    const right = worldFromScreen(camera, { x: 400, y: 300 }, viewport);
    expect(left.x).toBeLessThan(0);
    expect(left.y).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(200);
    expect(right.y).toBeGreaterThan(80);
    expect(camera.w / camera.h).toBeCloseTo(400 / 300, 5);
  });

  it("zooms around the cursor without moving that world point", () => {
    const viewport = { width: 400, height: 300 };
    const camera = { x: 0, y: 0, w: 400, h: 300 };
    const world = { x: 40, y: 30 };
    const screen = {
      x: ((world.x - camera.x) / camera.w) * viewport.width,
      y: ((world.y - camera.y) / camera.h) * viewport.height,
    };
    const next = zoomGraphCamera(camera, world, 2, viewport);
    const back = worldFromScreen(next, screen, viewport);
    expect(back.x).toBeCloseTo(world.x, 5);
    expect(back.y).toBeCloseTo(world.y, 5);
    const k = viewport.width / next.w;
    expect(world.x * k - next.x * k).toBeCloseTo(screen.x, 5);
    expect(world.y * k - next.y * k).toBeCloseTo(screen.y, 5);
    expect(graphWorldTransform(camera, viewport)).toBe(
      "translate(0 0) scale(1)",
    );
  });
});

describe("layoutKnowledgeGraph", () => {
  it("places every interned path and keeps edges as ints", () => {
    const layout = layoutKnowledgeGraph(snap);
    expect(layout.nodes.map((node) => node.path).sort()).toEqual(
      [...snap.paths].sort(),
    );
    expect(layout.edges).toEqual([
      { from: 0, to: 1, reciprocal: false },
      { from: 2, to: 1, reciprocal: false },
      { from: 2, to: 0, reciprocal: false },
    ]);
    expect(layout.nodes.every((node) => Number.isFinite(node.x))).toBe(true);
    const orphan = layout.nodes.find((node) => node.path === "orphan.md");
    expect(orphan?.isolate).toBe(true);
    const a = layout.nodes.find(
      (node) => node.path === "for/example/this-file.md",
    );
    const b = layout.nodes.find(
      (node) => node.path === "how-we-work/constraints.md",
    );
    expect(a && b).toBeTruthy();
    if (a && b) {
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      expect(dist).toBeGreaterThan(40);
      expect(dist).toBeLessThan(1600);
    }
  });

  it("collapses a two-way link into one reciprocal edge", () => {
    const layout = layoutKnowledgeGraph({
      paths: ["a.md", "b.md"],
      out: [[1], [0]],
    });
    expect(layout.edges).toEqual([{ from: 0, to: 1, reciprocal: true }]);
    const from = layout.nodes[0];
    const to = layout.nodes[1];
    expect(from && to).toBeTruthy();
    if (from && to) {
      const line = graphEdgeGeom(from, to);
      expect(line.d).toMatch(/ L /);
      expect(line.d).not.toMatch(/ Q /);
    }
  });

  it("spreads a small office graph instead of leaving a pile", () => {
    const layout = layoutKnowledgeGraph({
      paths: [
        "playbooks/handoff.md",
        "playbooks/SKILL.md",
        "notes/clients.md",
        "company/README.md",
        "sources/brief.md",
        "scratch/todo.md",
      ],
      out: [[1, 2, 3], [0], [0, 4], [0], [2], []],
    });
    const linked = layout.nodes.filter((node) => !node.isolate);
    const xs = linked.map((node) => node.x);
    const ys = linked.map((node) => node.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(500);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(120);
  });

  it("is empty when the snapshot is empty", () => {
    const layout = layoutKnowledgeGraph({ paths: [], out: [] });
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });

  it("keeps a large graph from collapsing after grid repulsion", () => {
    const n = 240;
    const paths = Array.from({ length: n }, (_, i) => `notes/n-${i}.md`);
    const out = paths.map((_, i) => {
      if (i === 0) return [1, 2, 3, 4];
      if (i < n - 1) return [i + 1];
      return [0];
    });
    const layout = layoutKnowledgeGraph({ paths, out });
    expect(layout.nodes).toHaveLength(n);
    const xs = layout.nodes.map((node) => node.x);
    const ys = layout.nodes.map((node) => node.y);
    const spread = Math.hypot(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    );
    expect(spread).toBeGreaterThan(180);
    let close = 0;
    for (let i = 0; i < 40; i++) {
      for (let j = i + 1; j < 40; j++) {
        const a = layout.nodes[i];
        const b = layout.nodes[j];
        if (!a || !b) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < 8) close += 1;
      }
    }
    expect(close).toBeLessThan(8);
  });
});

describe("live graph physics", () => {
  it("lets a dragged note tug its neighbors", () => {
    const layout = layoutKnowledgeGraph({
      paths: ["a.md", "b.md", "c.md"],
      out: [[1], [0, 2], [1]],
    });
    const sim = createGraphSim(layout.nodes, layout.edges);
    const a = layout.nodes.find((node) => node.path === "a.md");
    const b = layout.nodes.find((node) => node.path === "b.md");
    expect(a && b).toBeTruthy();
    if (!a || !b) return;
    const dx = a.x - (sim.x[b.id] ?? a.x);
    const dy = a.y - (sim.y[b.id] ?? a.y);
    const len = Math.hypot(dx, dy) || 1;
    const pinAt = {
      x: a.x + (dx / len) * 200,
      y: a.y + (dy / len) * 200,
    };
    const before = { x: sim.x[b.id] ?? 0, y: sim.y[b.id] ?? 0 };
    const distBefore = Math.hypot(before.x - pinAt.x, before.y - pinAt.y);
    pinGraphNode(sim, a.id, pinAt.x, pinAt.y);
    setGraphSimTarget(sim, 0.8);
    for (let i = 0; i < 40; i++) stepGraphSim(sim);
    expect(sim.x[a.id]).toBeCloseTo(pinAt.x, 5);
    expect(sim.y[a.id]).toBeCloseTo(pinAt.y, 5);
    const distAfter = Math.hypot(
      (sim.x[b.id] ?? 0) - pinAt.x,
      (sim.y[b.id] ?? 0) - pinAt.y,
    );
    expect(distAfter).toBeLessThan(distBefore - 8);
  });

  it("lets the tug travel to the next note in the chain", () => {
    const layout = layoutKnowledgeGraph({
      paths: ["a.md", "b.md", "c.md"],
      out: [[1], [0, 2], [1]],
    });
    const sim = createGraphSim(layout.nodes, layout.edges);
    const a = layout.nodes.find((node) => node.path === "a.md");
    const c = layout.nodes.find((node) => node.path === "c.md");
    expect(a && c).toBeTruthy();
    if (!a || !c) return;
    const before = { x: sim.x[c.id] ?? 0, y: sim.y[c.id] ?? 0 };
    const dx = a.x - before.x;
    const dy = a.y - before.y;
    const len = Math.hypot(dx, dy) || 1;
    pinGraphNode(sim, a.id, a.x + (dx / len) * 240, a.y + (dy / len) * 240);
    setGraphSimTarget(sim, 0.8);
    for (let i = 0; i < 50; i++) stepGraphSim(sim);
    const moved = Math.hypot(
      (sim.x[c.id] ?? 0) - before.x,
      (sim.y[c.id] ?? 0) - before.y,
    );
    expect(moved).toBeGreaterThan(6);
  });

  it("leaves isolates still while the linked cluster moves", () => {
    const layout = layoutKnowledgeGraph(snap);
    const sim = createGraphSim(layout.nodes, layout.edges);
    const orphan = layout.nodes.find((node) => node.path === "orphan.md");
    const hub = layout.nodes.find(
      (node) => node.path === "how-we-work/constraints.md",
    );
    expect(orphan && hub).toBeTruthy();
    if (!orphan || !hub) return;
    const ox = sim.x[orphan.id];
    const oy = sim.y[orphan.id];
    pinGraphNode(sim, hub.id, hub.x + 180, hub.y);
    setGraphSimTarget(sim, 0.8);
    for (let i = 0; i < 40; i++) stepGraphSim(sim);
    expect(sim.x[orphan.id]).toBe(ox);
    expect(sim.y[orphan.id]).toBe(oy);
  });

  it("zooms smoothly from wheel deltas", () => {
    expect(graphZoomFactor(0)).toBe(1);
    expect(graphZoomFactor(80)).toBeLessThan(1);
    expect(graphZoomFactor(-80)).toBeGreaterThan(1);
  });
});
