import { describe, expect, it } from "vitest";
import {
  fitGraphCamera,
  graphEdgeGeom,
  graphFolder,
  graphFolderHue,
  graphNodeLabel,
  indexKnowledgeGraph,
  knowledgeGraphBacklinks,
  knowledgeGraphLinkedIds,
  layoutKnowledgeGraph,
  pickGraphLabels,
  worldFromScreen,
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
  });
});

describe("graph labels", () => {
  it("uses the note name, and the parent folder for SKILL.md", () => {
    expect(graphNodeLabel("playbooks/weekly-update/SKILL.md")).toBe(
      "weekly-update",
    );
    expect(graphNodeLabel("playbooks/SKILL.md")).toBe("SKILL");
    expect(graphNodeLabel("notes/clients.md")).toBe("clients");
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
    const camera = fitGraphCamera(
      [
        { x: 0, y: 0, r: 8 },
        { x: 200, y: 80, r: 8 },
      ],
      { width: 400, height: 300 },
    );
    const left = worldFromScreen(camera, { x: 0, y: 0 });
    const right = worldFromScreen(camera, { x: 400, y: 300 });
    expect(left.x).toBeLessThan(0);
    expect(left.y).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(200);
    expect(right.y).toBeGreaterThan(80);
  });

  it("zooms around the cursor without moving that world point", () => {
    const camera = { x: 12, y: 8, k: 1 };
    const world = { x: 40, y: 30 };
    const screen = {
      x: world.x * camera.k + camera.x,
      y: world.y * camera.k + camera.y,
    };
    const next = zoomGraphCamera(camera, world, 2);
    expect(worldFromScreen(next, screen)).toEqual(world);
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
      expect(dist).toBeLessThan(900);
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
      const bent = graphEdgeGeom(from, to, true);
      const straightish = graphEdgeGeom(from, to, false);
      expect(bent.d).not.toBe(straightish.d);
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
    const span = Math.hypot(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    );
    expect(span).toBeGreaterThan(400);
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
