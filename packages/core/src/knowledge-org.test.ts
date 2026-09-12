import { describe, expect, it } from "vitest";
import {
  formatGoalMarkdown,
  formatOrgMarkdown,
  GOAL_KNOWLEDGE_PATH,
  ORG_KNOWLEDGE_PATH,
  officeOrgKnowledgeFiles,
} from "./knowledge-org.js";
import { knowledgeSearchDoc } from "./knowledge-search.js";

describe("officeOrgKnowledgeFiles", () => {
  it("always writes org.md and skips goal.md when they skip the hint", () => {
    const files = officeOrgKnowledgeFiles({ name: "Northwind Labs" });
    expect(files.map((row) => row.path)).toEqual([ORG_KNOWLEDGE_PATH]);
    expect(files[0]?.content).toMatch(/^---\ntitle: Northwind Labs\n---\n/);
    expect(files[0]?.content).toMatch(/# Northwind Labs/);
    expect(formatGoalMarkdown("  ")).toBeNull();
  });

  it("adds goal.md only when they say what they are building", () => {
    const files = officeOrgKnowledgeFiles({
      name: "Northwind Labs",
      team: "Founders and a few engineers",
      goal: "Ship a weekly product for sales.",
    });
    expect(files.map((row) => row.path)).toEqual([
      ORG_KNOWLEDGE_PATH,
      GOAL_KNOWLEDGE_PATH,
    ]);
    const org = files[0]?.content ?? "";
    const goal = files[1]?.content ?? "";
    expect(org).toMatch(/oneline: Founders and a few engineers/);
    expect(org).toMatch(/Founders and a few engineers/);
    expect(goal).toMatch(/title: What we're building/);
    expect(goal).toMatch(/Ship a weekly product for sales\./);
    expect(knowledgeSearchDoc(ORG_KNOWLEDGE_PATH, org)).toMatchObject({
      title: "Northwind Labs",
      description: "Founders and a few engineers",
    });
    expect(knowledgeSearchDoc(GOAL_KNOWLEDGE_PATH, goal)).toMatchObject({
      title: "What we're building",
      description: "Ship a weekly product for sales.",
    });
  });

  it("quotes YAML when the team name has a colon", () => {
    expect(formatOrgMarkdown({ name: "Acme: Labs" })).toMatch(
      /title: "Acme: Labs"/,
    );
  });
});
