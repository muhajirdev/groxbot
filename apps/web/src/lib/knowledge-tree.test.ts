import type { KnowledgeEntry } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  coversKnowledgePath,
  filterKnowledgeTree,
  filterOfficeSkillRows,
  findKnowledgeNode,
  knowledgeMenuItems,
  matchingOfficeSkill,
  nestKnowledgeTree,
  officeSkillDirectory,
  officeSkillFileLabel,
  officeSkillFiles,
  officeSkillRows,
  groupOfficeSkillFiles,
  officeSkillPackSummary,
  officeSkills,
  rankOfficeSkillRows,
  countOfficeSkillHits,
  knowledgeSearchStatus,
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
      name: "SKILL.md",
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

describe("rankOfficeSkillRows", () => {
  it("orders playbooks by search hits", () => {
    const rows = officeSkillRows(entries, "playbooks");
    expect(
      rankOfficeSkillRows(
        rows,
        [{ path: "playbooks/weekly-update/references/notes.md" }],
        "standup",
      ).map((row) => row.path),
    ).toEqual(["playbooks/weekly-update/SKILL.md"]);
  });

  it("counts unique playbooks from hits, including files under the skill", () => {
    const rows = officeSkillRows(entries, "playbooks");
    expect(
      countOfficeSkillHits(rows, [
        { path: "playbooks/weekly-update/SKILL.md" },
        { path: "playbooks/weekly-update/references/notes.md" },
        { path: "how-we-work/constraints.md" },
      ]),
    ).toBe(1);
  });
});

describe("knowledgeSearchStatus", () => {
  it("says when notes are ranking, and when it fell back to names", () => {
    expect(
      knowledgeSearchStatus({
        query: "standup",
        fetching: true,
        hitCount: 0,
        fallbackCount: 2,
      }),
    ).toEqual({ label: "Searching notes…", busy: true });
    expect(
      knowledgeSearchStatus({
        query: "standup",
        fetching: false,
        hitCount: 3,
        fallbackCount: 0,
      }),
    ).toEqual({ label: "3 notes", busy: false });
    expect(
      knowledgeSearchStatus({
        query: "standup",
        fetching: false,
        hitCount: 0,
        fallbackCount: 2,
      }),
    ).toEqual({ label: "Matching names", busy: false });
  });

  it("names playbooks in the skills view", () => {
    expect(
      knowledgeSearchStatus({
        query: "digest",
        fetching: true,
        hitCount: 0,
        fallbackCount: 0,
        kind: "skills",
      }),
    ).toEqual({ label: "Searching playbooks…", busy: true });
    expect(
      knowledgeSearchStatus({
        query: "digest",
        fetching: false,
        hitCount: 1,
        fallbackCount: 0,
        kind: "skills",
      }),
    ).toEqual({ label: "1 playbook", busy: false });
  });
});

describe("findKnowledgeNode", () => {
  it("finds a nested folder or file", () => {
    const tree = nestKnowledgeTree(entries);
    expect(findKnowledgeNode(tree, "playbooks/weekly-update")?.kind).toBe(
      "dir",
    );
    expect(findKnowledgeNode(tree, "how-we-work/constraints.md")?.name).toBe(
      "constraints.md",
    );
    expect(findKnowledgeNode(tree, "missing")).toBeNull();
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
        shared: false,
      }),
    ).toEqual([
      { id: "download", label: "Download" },
      { id: "share", label: "Share publicly…" },
      { id: "copy-office-link", label: "Copy office link" },
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
        shared: false,
      }).map((item) => item.id),
    ).toEqual(["download", "use", "share", "copy-office-link", "copy-path", "delete"]);
  });

  it("lists new file, copy, and delete for a folder", () => {
    expect(
      knowledgeMenuItems({
        name: "playbooks",
        kind: "dir",
        skill: false,
        phase: "actions",
        shared: false,
      }).map((item) => item.id),
    ).toEqual(["new-file", "share", "copy-office-link", "copy-path", "delete"]);
  });

  it("copies and unpublishes an existing public link", () => {
    expect(
      knowledgeMenuItems({
        name: "constraints",
        kind: "file",
        skill: false,
        phase: "actions",
        shared: true,
      }).map((item) => item.id),
    ).toEqual([
      "download",
      "copy-public-link",
      "unpublish",
      "copy-office-link",
      "copy-path",
      "delete",
    ]);
  });

  it("warns that a folder share includes later files", () => {
    expect(
      knowledgeMenuItems({
        name: "playbooks",
        kind: "dir",
        skill: false,
        phase: "confirm-share",
        shared: false,
      }),
    ).toEqual([
      {
        id: "confirm-share",
        label: "Publish this folder — later files too",
      },
      { id: "cancel-share", label: "Cancel" },
    ]);
  });

  it("confirms delete with the name", () => {
    expect(
      knowledgeMenuItems({
        name: "constraints",
        kind: "file",
        skill: false,
        phase: "confirm-delete",
        shared: false,
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

describe("officeSkillRows", () => {
  const catalog: KnowledgeEntry[] = [
    {
      path: "skills/digest/SKILL.md",
      name: "SKILL.md",
      title: "digest",
      description: "Summarize the week.",
      encoding: "text",
      mediaType: "text/markdown",
    },
    {
      path: "skills/digest/references/notes.md",
      name: "notes.md",
      title: "notes",
      description: "",
      encoding: "text",
      mediaType: "text/markdown",
    },
    {
      path: "skills/client-agreements/SKILL.md",
      name: "SKILL.md",
      title: "agreements",
      description: "Draft the client agreement.",
      encoding: "text",
      mediaType: "text/markdown",
    },
    {
      path: "playbooks/weekly-update/SKILL.md",
      name: "SKILL.md",
      title: "weekly-update",
      description: "Five-bullet Monday.",
      encoding: "text",
      mediaType: "text/markdown",
    },
  ];

  it("lists playbooks in skills/, not nested files or other folders", () => {
    expect(officeSkillRows(catalog)).toEqual([
      {
        name: "agreements",
        description: "Draft the client agreement.",
        path: "skills/client-agreements/SKILL.md",
        directory: "skills/client-agreements",
        files: 1,
        pack: "",
      },
      {
        name: "digest",
        description: "Summarize the week.",
        path: "skills/digest/SKILL.md",
        directory: "skills/digest",
        files: 2,
        pack: "references",
      },
    ]);
  });

  it("lists every file in a skill folder, SKILL.md first", () => {
    expect(
      officeSkillFiles(catalog, "skills/digest").map((row) => row.name),
    ).toEqual(["SKILL.md", "references/notes.md"]);
  });

  it("groups pack files the way a skill folder is meant to look", () => {
    const files = officeSkillFiles(
      [
        ...catalog,
        {
          path: "skills/digest/scripts/run.sh",
          name: "run.sh",
          title: "run",
          description: "",
          encoding: "text",
          mediaType: "text/x-shellscript",
        },
        {
          path: "skills/digest/templates/memo.md",
          name: "memo.md",
          title: "memo",
          description: "",
          encoding: "text",
          mediaType: "text/markdown",
        },
        {
          path: "skills/digest/examples/week.md",
          name: "week.md",
          title: "week",
          description: "",
          encoding: "text",
          mediaType: "text/markdown",
        },
      ],
      "skills/digest",
    );
    expect(
      groupOfficeSkillFiles(files).map((group) => [
        group.kind,
        group.files.map((file) => officeSkillFileLabel(file)),
      ]),
    ).toEqual([
      ["playbook", ["SKILL.md"]],
      ["references", ["notes.md"]],
      ["scripts", ["run.sh"]],
      ["templates", ["memo.md"]],
      ["examples", ["week.md"]],
    ]);
    expect(officeSkillPackSummary(files)).toBe(
      "references · scripts · templates · examples",
    );
  });

  it("filters by name or description", () => {
    expect(
      filterOfficeSkillRows(officeSkillRows(catalog), "week").map(
        (row) => row.name,
      ),
    ).toEqual(["digest"]);
  });

  it("matches a skill folder or a file under it", () => {
    const rows = officeSkillRows(catalog);
    expect(matchingOfficeSkill(rows, "skills/digest/SKILL.md")?.name).toBe(
      "digest",
    );
    expect(matchingOfficeSkill(rows, "skills/digest")?.name).toBe("digest");
    expect(
      matchingOfficeSkill(rows, "skills/digest/references/notes.md")?.name,
    ).toBe("digest");
    expect(matchingOfficeSkill(rows, "skills")).toBeNull();
    expect(officeSkillDirectory("skills/digest/SKILL.md")).toBe(
      "skills/digest",
    );
  });
});
