import type { KnowledgeEntry } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  filterKnowledgeTree,
  nestKnowledgeTree,
  officeSkills,
} from "./knowledge-tree";

const entries: KnowledgeEntry[] = [
  {
    path: "playbooks/weekly-update/SKILL.md",
    name: "SKILL.md",
    title: "weekly-update",
    description: "Five-bullet Monday.",
    encoding: "text",
    mediaType: "text/markdown",
  },
  {
    path: "how-we-work/constraints.md",
    name: "constraints.md",
    title: "constraints",
    description: "",
    encoding: "text",
    mediaType: "text/markdown",
  },
];

describe("nestKnowledgeTree", () => {
  it("builds only folders that exist", () => {
    const tree = nestKnowledgeTree(entries);
    expect(tree.map((node) => node.path)).toEqual(["how-we-work", "playbooks"]);
    expect(tree[1]?.children[0]?.children[0]).toMatchObject({
      path: "playbooks/weekly-update/SKILL.md",
      kind: "file",
    });
  });
});

describe("filterKnowledgeTree", () => {
  it("keeps a parent when a child description matches", () => {
    const found = filterKnowledgeTree(nestKnowledgeTree(entries), "monday");
    expect(found.map((node) => node.path)).toEqual(["playbooks"]);
  });
});

describe("officeSkills", () => {
  it("lists slash names from SKILL.md files", () => {
    expect(officeSkills(entries)).toEqual([
      { name: "weekly-update", description: "Five-bullet Monday." },
    ]);
  });

  it("uses the YAML skill name, not the folder", () => {
    expect(
      officeSkills([
        {
          path: "skills/client-agreements/SKILL.md",
          name: "SKILL.md",
          title: "agreements",
          description: "Draft the client agreement.",
          encoding: "text",
          mediaType: "text/markdown",
        },
      ]),
    ).toEqual([
      { name: "agreements", description: "Draft the client agreement." },
    ]);
  });
});
