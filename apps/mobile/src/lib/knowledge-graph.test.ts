import { describe, expect, it } from "vitest";
import {
  graphNodeLabel,
  indexKnowledgeGraph,
  knowledgeGraphBacklinks,
  knowledgeGraphOutgoing,
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
    expect(
      knowledgeGraphOutgoing(index, "playbooks/weekly-update/SKILL.md"),
    ).toEqual(["for/example/this-file.md", "how-we-work/constraints.md"]);
    expect(knowledgeGraphBacklinks(index, "orphan.md")).toEqual([]);
    expect(graphNodeLabel("playbooks/weekly-update/SKILL.md")).toBe("SKILL.md");
  });
});
