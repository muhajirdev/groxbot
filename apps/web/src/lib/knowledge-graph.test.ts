import { describe, expect, it } from "vitest";
import {
  graphNodeLabel,
  indexKnowledgeGraph,
  knowledgeGraphBacklinks,
  knowledgeGraphLinkedIds,
  layoutKnowledgeGraph,
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
    expect(knowledgeGraphBacklinks(index, "how-we-work/constraints.md")).toEqual(
      ["for/example/this-file.md", "playbooks/weekly-update/SKILL.md"],
    );
    expect(knowledgeGraphBacklinks(index, "orphan.md")).toEqual([]);
    expect(knowledgeGraphLinkedIds(index, "for/example/this-file.md")).toEqual(
      new Set([0, 1, 2]),
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
      { from: 0, to: 1 },
      { from: 2, to: 1 },
      { from: 2, to: 0 },
    ]);
    expect(layout.nodes.every((node) => Number.isFinite(node.x))).toBe(true);
    expect(graphNodeLabel("playbooks/weekly-update/SKILL.md")).toBe("SKILL.md");
  });

  it("is empty when the snapshot is empty", () => {
    const layout = layoutKnowledgeGraph({ paths: [], out: [] });
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });
});
