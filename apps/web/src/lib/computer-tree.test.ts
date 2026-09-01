import type { ComputerEntry } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { nestComputerEntries, filterComputerTree } from "./computer-tree";

describe("nestComputerEntries", () => {
  it("nests files under folders", () => {
    const entries: ComputerEntry[] = [
      { path: "memory.md", kind: "file" },
      { path: "skills", kind: "dir" },
      { path: "skills/digest", kind: "dir" },
      { path: "skills/digest/SKILL.md", kind: "file" },
    ];
    expect(nestComputerEntries(entries)).toEqual([
      {
        path: "skills",
        name: "skills",
        kind: "dir",
        size: undefined,
        children: [
          {
            path: "skills/digest",
            name: "digest",
            kind: "dir",
            size: undefined,
            children: [
              {
                path: "skills/digest/SKILL.md",
                name: "SKILL.md",
                kind: "file",
                size: undefined,
                children: [],
              },
            ],
          },
        ],
      },
      {
        path: "memory.md",
        name: "memory.md",
        kind: "file",
        size: undefined,
        children: [],
      },
    ]);
  });
});

describe("filterComputerTree", () => {
  const tree = nestComputerEntries([
    { path: "inbox", kind: "dir" },
    { path: "inbox/brief.md", kind: "file" },
    { path: "inbox/deal.pdf", kind: "file" },
    { path: "memory.md", kind: "file" },
  ]);

  it("returns the full tree when the query is empty", () => {
    expect(filterComputerTree(tree, "  ")).toEqual(tree);
  });

  it("keeps a parent folder when a child matches", () => {
    const found = filterComputerTree(tree, "deal");
    expect(found.map((node) => node.path)).toEqual(["inbox"]);
    expect(found[0]?.children.map((node) => node.path)).toEqual([
      "inbox/deal.pdf",
    ]);
  });

  it("keeps a matching root file", () => {
    const found = filterComputerTree(tree, "memory");
    expect(found.map((node) => node.path)).toEqual(["memory.md"]);
  });
});
