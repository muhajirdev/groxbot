import { describe, expect, it } from "vitest";
import { encodeComputerBytes } from "./computer.js";
import {
  downloadKnowledge,
  filterKnowledgeTree,
  formatSkillMarkdown,
  isKnowledgeSkillFile,
  type KnowledgeDisk,
  type KnowledgeObject,
  KnowledgePathError,
  knowledgeObjectKey,
  knowledgeSkillWorkspace,
  listKnowledge,
  listKnowledgeGraph,
  nestKnowledgeTree,
  officeSkillSource,
  botSkillSources,
  readKnowledge,
  readKnowledgeMany,
  removeKnowledge,
  sanitizeKnowledgePath,
  searchKnowledge,
  writeKnowledge,
} from "./knowledge.js";

class MemoryKnowledge implements KnowledgeDisk {
  readonly files = new Map<string, Uint8Array>();

  async list(prefix: string): Promise<KnowledgeObject[]> {
    return [...this.files.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, bytes]) => ({ key, size: bytes.byteLength }));
  }

  async getText(key: string): Promise<string | null> {
    const bytes = this.files.get(key);
    return bytes ? new TextDecoder().decode(bytes) : null;
  }

  async getBytes(key: string): Promise<Uint8Array | null> {
    return this.files.get(key) ?? null;
  }

  async put(key: string, content: string | Uint8Array): Promise<void> {
    const bytes =
      typeof content === "string" ? new TextEncoder().encode(content) : content;
    this.files.set(key, bytes);
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }
}

const OFFICE = "ws_office";

function skillDoc(name: string, description: string, body: string): string {
  return formatSkillMarkdown({ name, description, body });
}

describe("sanitizeKnowledgePath", () => {
  it("rejects parent segments", () => {
    expect(() => sanitizeKnowledgePath("playbooks/../../secret")).toThrow(
      KnowledgePathError,
    );
  });

  it("builds a tenant key from the office id", () => {
    expect(knowledgeObjectKey(OFFICE, "playbooks/weekly-update/SKILL.md")).toBe(
      "ws_office/playbooks/weekly-update/SKILL.md",
    );
  });
});

describe("isKnowledgeSkillFile", () => {
  it("is a SKILL.md anywhere in the tree", () => {
    expect(isKnowledgeSkillFile("SKILL.md")).toBe(true);
    expect(isKnowledgeSkillFile("playbooks/weekly-update/SKILL.md")).toBe(true);
    expect(
      isKnowledgeSkillFile("playbooks/weekly-update/references/voice.md"),
    ).toBe(false);
  });
});

describe("listKnowledge", () => {
  it("lists the free tree, including skill guts", async () => {
    const disk = new MemoryKnowledge();
    await disk.put(
      `${OFFICE}/playbooks/weekly-update/SKILL.md`,
      skillDoc("weekly-update", "Five bullets.", "Keep it tight."),
    );
    await disk.put(
      `${OFFICE}/playbooks/weekly-update/references/voice.md`,
      "quiet",
    );
    await disk.put(`${OFFICE}/how-we-work/constraints.md`, "No mail.");
    await disk.put(`${OFFICE}/brief.pdf`, new Uint8Array([1, 2, 3]));
    const listed = await listKnowledge(disk, OFFICE);
    expect(listed.entries.map((row) => row.path).sort()).toEqual(
      [
        "brief.pdf",
        "how-we-work/constraints.md",
        "playbooks/weekly-update/SKILL.md",
        "playbooks/weekly-update/references/voice.md",
      ].sort(),
    );
    expect(
      listed.entries.find((row) => row.path.endsWith("/SKILL.md")),
    ).toMatchObject({
      name: "SKILL.md",
      title: "weekly-update",
      description: "Five bullets.",
    });
    expect(
      listed.entries.find((row) => row.path === "how-we-work/constraints.md"),
    ).toMatchObject({
      name: "constraints.md",
      title: "constraints.md",
    });
    expect(
      listed.entries.find((row) => row.path === "brief.pdf")?.encoding,
    ).toBe("binary");
  });

  it("does not leak another office", async () => {
    const disk = new MemoryKnowledge();
    await disk.put(
      "ws_other/playbooks/secret/SKILL.md",
      skillDoc("secret", "Hidden.", "nope"),
    );
    const listed = await listKnowledge(disk, OFFICE);
    expect(listed.entries).toEqual([]);
  });
});

describe("write and read", () => {
  it("saves at the path you name", async () => {
    const disk = new MemoryKnowledge();
    await writeKnowledge(disk, OFFICE, {
      path: "playbooks/weekly-update/SKILL.md",
      content: skillDoc(
        "weekly-update",
        "Five-bullet Monday.",
        "One line each.",
      ),
    });
    await writeKnowledge(disk, OFFICE, {
      path: "how-we-work/constraints.md",
      content: "Never send mail without approval.",
    });
    const skill = await readKnowledge(
      disk,
      OFFICE,
      "playbooks/weekly-update/SKILL.md",
    );
    expect(skill.title).toBe("weekly-update");
    expect(skill.description).toBe("Five-bullet Monday.");
    expect(skill.content).toMatch(/One line each/);
    const note = await readKnowledge(
      disk,
      OFFICE,
      "how-we-work/constraints.md",
    );
    expect(note.title).toBe("constraints.md");
    expect(note.content).toBe("Never send mail without approval.");
  });

  it("indexes markdown links and hides the snapshot from the tree", async () => {
    const disk = new MemoryKnowledge();
    await writeKnowledge(disk, OFFICE, {
      path: "how-we-work/constraints.md",
      content: "Never send mail without approval.",
    });
    await writeKnowledge(disk, OFFICE, {
      path: "for/example/this-file.md",
      content: "Follow [constraints](how-we-work/constraints.md).",
    });
    const listed = await listKnowledge(disk, OFFICE);
    expect(listed.entries.map((row) => row.path)).not.toContain(
      "_links/index.json",
    );
    expect(listed.entries.map((row) => row.path)).not.toContain(
      "_search/index.json",
    );
    const note = await readKnowledge(
      disk,
      OFFICE,
      "how-we-work/constraints.md",
    );
    expect(note.backlinks).toEqual(["for/example/this-file.md"]);
    expect(await listKnowledgeGraph(disk, OFFICE)).toEqual({
      paths: ["for/example/this-file.md", "how-we-work/constraints.md"],
      out: [[1], []],
    });
  });

  it("downloads binary bytes", async () => {
    const disk = new MemoryKnowledge();
    await disk.put(`${OFFICE}/brief.pdf`, new Uint8Array([1, 2, 3, 4]));
    const file = await downloadKnowledge(disk, OFFICE, "brief.pdf");
    expect(file.filename).toBe("brief.pdf");
    expect(file.mediaType).toBe("application/pdf");
    expect(file.content).toBe(
      encodeComputerBytes(new Uint8Array([1, 2, 3, 4])),
    );
  });

  it("removes a folder prefix", async () => {
    const disk = new MemoryKnowledge();
    await writeKnowledge(disk, OFFICE, {
      path: "playbooks/weekly-update/SKILL.md",
      content: skillDoc("weekly-update", "Five bullets.", "Do it."),
    });
    await disk.put(
      `${OFFICE}/playbooks/weekly-update/references/voice.md`,
      "quiet",
    );
    await removeKnowledge(disk, OFFICE, "playbooks/weekly-update");
    expect(disk.files.size).toBe(0);
  });

  it("searches the office by title and body", async () => {
    const disk = new MemoryKnowledge();
    await writeKnowledge(disk, OFFICE, {
      path: "skills/weekly-update/SKILL.md",
      content: skillDoc("weekly-update", "Five bullets.", "Keep it tight."),
    });
    await writeKnowledge(disk, OFFICE, {
      path: "how-we-work/constraints.md",
      content: "# Constraints\nNever send mail without approval.",
    });
    const found = await searchKnowledge(disk, OFFICE, "weekly update");
    expect(found.hits[0]?.path).toBe("skills/weekly-update/SKILL.md");
    const mail = await searchKnowledge(disk, OFFICE, "never send mail");
    expect(mail.hits[0]?.path).toBe("how-we-work/constraints.md");
    expect(
      [...disk.files.keys()].some((key) => key.endsWith("/_search/index.json")),
    ).toBe(true);
    expect(
      [...disk.files.keys()].some((key) =>
        key.endsWith("/_search/manifest.json"),
      ),
    ).toBe(false);
    expect(
      [...disk.files.keys()].some((key) => key.includes("/_search/s/")),
    ).toBe(false);
  });

  it("rebuilds search when the snapshot is missing", async () => {
    const disk = new MemoryKnowledge();
    await disk.put(
      `${OFFICE}/how-we-work/constraints.md`,
      "Never send mail without approval.",
    );
    const found = await searchKnowledge(disk, OFFICE, "send mail");
    expect(found.hits[0]?.path).toBe("how-we-work/constraints.md");
  });

  it("folds leftover search shards into one index.json", async () => {
    const disk = new MemoryKnowledge();
    await disk.put(`${OFFICE}/notes/a.md`, "# Alpha\nThe weekly update.");
    await disk.put(
      `${OFFICE}/_search/s/000.json`,
      JSON.stringify({
        docs: [
          {
            path: "notes/a.md",
            title: "Alpha",
            description: "",
            text: "The weekly update.",
          },
        ],
      }),
    );
    await disk.put(
      `${OFFICE}/_search/manifest.json`,
      JSON.stringify({
        v: 4,
        rev: 1,
        updatedAt: new Date().toISOString(),
        segments: ["_search/s/000.json"],
      }),
    );
    const found = await searchKnowledge(disk, OFFICE, "weekly update");
    expect(found.hits[0]?.path).toBe("notes/a.md");
    expect(
      [...disk.files.keys()].some((key) => key.endsWith("/_search/index.json")),
    ).toBe(true);
    expect(
      [...disk.files.keys()].some((key) =>
        key.endsWith("/_search/manifest.json"),
      ),
    ).toBe(false);
    expect(
      [...disk.files.keys()].some((key) => key.includes("/_search/s/")),
    ).toBe(false);
  });

  it("reads several files in one pass", async () => {
    const disk = new MemoryKnowledge();
    await writeKnowledge(disk, OFFICE, {
      path: "how-we-work/constraints.md",
      content: "Never send mail without approval.",
    });
    await writeKnowledge(disk, OFFICE, {
      path: "how-we-work/voice.md",
      content: "Short. Direct.",
    });
    const many = await readKnowledgeMany(disk, OFFICE, [
      "how-we-work/constraints.md",
      "how-we-work/voice.md",
      "missing.md",
    ]);
    expect(many.files.map((row) => row.path)).toEqual([
      "how-we-work/constraints.md",
      "how-we-work/voice.md",
    ]);
    expect(many.missing).toEqual(["missing.md"]);
  });
});

describe("nestKnowledgeTree", () => {
  it("has no forced roots", () => {
    expect(nestKnowledgeTree([])).toEqual([]);
  });

  it("nests whatever paths exist, files at the top included", () => {
    const tree = nestKnowledgeTree([
      {
        path: "playbooks/weekly-update/SKILL.md",
        name: "SKILL.md",
        title: "weekly-update",
        description: "Five bullets.",
        encoding: "text",
        mediaType: "text/markdown",
      },
      {
        path: "voice.md",
        name: "voice.md",
        title: "voice",
        description: "",
        encoding: "text",
        mediaType: "text/markdown",
      },
    ]);
    expect(tree.map((node) => node.path)).toEqual(["playbooks", "voice.md"]);
    expect(tree[0]?.children[0]?.path).toBe("playbooks/weekly-update");
    expect(tree[0]?.children[0]?.children[0]).toMatchObject({
      path: "playbooks/weekly-update/SKILL.md",
      name: "SKILL.md",
      kind: "file",
    });
    expect(tree.find((node) => node.path === "voice.md")).toMatchObject({
      name: "voice.md",
    });
  });
});

describe("filterKnowledgeTree", () => {
  const tree = nestKnowledgeTree([
    {
      path: "playbooks/weekly-update/SKILL.md",
      name: "SKILL.md",
      title: "weekly-update",
      description: "Five-bullet Monday.",
      encoding: "text",
      mediaType: "text/markdown",
    },
  ]);

  it("keeps a parent when a child matches", () => {
    const found = filterKnowledgeTree(tree, "monday");
    expect(found.map((node) => node.path)).toEqual(["playbooks"]);
    expect(found[0]?.children[0]?.children[0]?.path).toBe(
      "playbooks/weekly-update/SKILL.md",
    );
  });
});

describe("officeSkillSource", () => {
  it("lists SKILL.md playbooks from the office knowledge tree", async () => {
    const disk = new MemoryKnowledge();
    await writeKnowledge(disk, OFFICE, {
      path: "playbooks/weekly-update/SKILL.md",
      content: skillDoc(
        "weekly-update",
        "Five-bullet Monday.",
        "One line each.",
      ),
    });
    const source = officeSkillSource(disk, OFFICE);
    const listed = await source.list();
    expect(listed).toMatchObject([
      {
        name: "weekly-update",
        description: "Five-bullet Monday.",
        sourceId: "office:skills",
      },
    ]);
    const loaded = await source.load("weekly-update");
    expect(loaded?.body).toMatch(/One line each/);
  });

  it("skips the office source until the actor has an office id", () => {
    const disk = new MemoryKnowledge();
    const workspace = knowledgeSkillWorkspace(disk, OFFICE);
    expect(
      botSkillSources({
        knowledge: disk,
        officeId: "",
        workspace,
      }).map((source) => source.id),
    ).toEqual(["workspace:skills"]);
    expect(
      botSkillSources({
        knowledge: disk,
        officeId: OFFICE,
        workspace,
      }).map((source) => source.id),
    ).toEqual(["office:skills", "workspace:skills"]);
  });

  it("reads skill files through the workspace adapter", async () => {
    const disk = new MemoryKnowledge();
    await writeKnowledge(disk, OFFICE, {
      path: "playbooks/weekly-update/SKILL.md",
      content: skillDoc("weekly-update", "Five bullets.", "Do it."),
    });
    const workspace = knowledgeSkillWorkspace(disk, OFFICE);
    await expect(
      workspace.readFile("playbooks/weekly-update/SKILL.md"),
    ).resolves.toMatch(/Do it/);
  });
});
