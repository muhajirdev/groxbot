import type { KnowledgeEntry } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  coversKnowledgePath,
  filterKnowledgeTree,
  knowledgeMenuItems,
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

describe("knowledgeMenuItems", () => {
  it("lists download, copy, and delete for a file", () => {
    expect(
      knowledgeMenuItems({
        name: "constraints",
        kind: "file",
        skill: false,
        phase: "actions",
      }),
    ).toEqual([
      { id: "download", label: "Download" },
      { id: "copy-path", label: "Copy path" },
      { id: "delete", label: "Delete", danger: true },
    ]);
  });

  it("adds use in chat for a skill", () => {
    expect(
      knowledgeMenuItems({
        name: "SKILL.md",
        kind: "file",
        skill: true,
        phase: "actions",
      }).map((item) => item.id),
    ).toEqual(["download", "use", "copy-path", "delete"]);
  });

  it("lists new file, copy, and delete for a folder", () => {
    expect(
      knowledgeMenuItems({
        name: "playbooks",
        kind: "dir",
        skill: false,
        phase: "actions",
      }).map((item) => item.id),
    ).toEqual(["new-file", "copy-path", "delete"]);
  });

  it("confirms delete with the name", () => {
    expect(
      knowledgeMenuItems({
        name: "constraints",
        kind: "file",
        skill: false,
        phase: "confirm-delete",
      }),
    ).toEqual([
      { id: "delete", label: "Delete constraints", danger: true },
      { id: "cancel-delete", label: "Cancel" },
    ]);
  });
});

describe("coversKnowledgePath", () => {
  it("treats a file as covering itself and children of a folder", () => {
    expect(coversKnowledgePath("notes.md", "notes.md")).toBe(true);
    expect(
      coversKnowledgePath("playbooks", "playbooks/weekly-update/SKILL.md"),
    ).toBe(true);
    expect(coversKnowledgePath("playbooks", "how-we-work")).toBe(false);
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
