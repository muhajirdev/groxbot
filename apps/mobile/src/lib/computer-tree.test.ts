import type { ComputerEntry } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { filterComputerTree, nestComputerEntries } from "./computer-tree";

describe("nestComputerEntries", () => {
  it("nests files under folders", () => {
    const entries: ComputerEntry[] = [
      { path: "memory.md", kind: "file" },
      { path: "skills", kind: "dir" },
      { path: "skills/digest", kind: "dir" },
      { path: "skills/digest/SKILL.md", kind: "file" },
    ];
    const tree = nestComputerEntries(entries);
    expect(tree[0]?.name).toBe("skills");
    expect(tree[1]?.name).toBe("memory.md");
  });
});

describe("filterComputerTree", () => {
  it("keeps folders that contain a match", () => {
    const tree = nestComputerEntries([
      { path: "skills", kind: "dir" },
      { path: "skills/SKILL.md", kind: "file" },
      { path: "notes.txt", kind: "file" },
    ]);
    expect(filterComputerTree(tree, "skill").map((row) => row.name)).toEqual([
      "skills",
    ]);
  });
});
