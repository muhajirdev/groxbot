import { describe, expect, it } from "vitest";
import {
  MAX_WORKSPACE_SKILLS,
  parseSkillMarkdown,
  skillFilePath,
  skillResourcePathError,
  workspaceSkillSource,
  type SkillWorkspace,
} from "./skills.js";

class MemoryWorkspace implements SkillWorkspace {
  readonly files = new Map<string, string>();

  async readFile(path: string): Promise<string | null> {
    return this.files.get(norm(path)) ?? null;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(norm(path), content);
  }

  async rm(path: string): Promise<void> {
    const prefix = `${norm(path)}/`;
    this.files.delete(norm(path));
    for (const key of [...this.files.keys()]) {
      if (key.startsWith(prefix)) this.files.delete(key);
    }
  }

  async glob(pattern: string): Promise<string[]> {
    const re = globRe(pattern);
    return [...this.files.keys()].filter((path) => re.test(path)).sort();
  }

  async readDir(path: string): Promise<{ path: string; type: string }[]> {
    const prefix = `${norm(path)}/`;
    const names = new Map<string, string>();
    for (const file of this.files.keys()) {
      if (!file.startsWith(prefix)) continue;
      const rest = file.slice(prefix.length);
      const cut = rest.indexOf("/");
      if (cut === -1) names.set(rest, "file");
      else names.set(rest.slice(0, cut), "directory");
    }
    return [...names.entries()].map(([name, type]) => ({
      path: name,
      type,
    }));
  }

  async stat(path: string) {
    const content = this.files.get(norm(path));
    return content == null ? null : { type: "file", size: content.length };
  }
}

function norm(path: string): string {
  return path.replace(/^\.?\//, "").replace(/\/+$/, "");
}

function globRe(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `^${escaped.replace(/\*\*/g, ":::").replace(/\*/g, "[^/]+").replace(/:::/g, ".*")}$`,
  );
}

function skillDoc(name: string, description: string, body: string): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n${body}`;
}

describe("parseSkillMarkdown", () => {
  it("reads name, description, and body", () => {
    const parsed = parseSkillMarkdown(
      skillDoc("weekly-update", "Monday status.", "Keep it to five bullets."),
    );
    expect(parsed).toMatchObject({
      name: "weekly-update",
      description: "Monday status.",
      body: "Keep it to five bullets.",
    });
  });

  it("rejects a missing description or a bad name", () => {
    expect(parseSkillMarkdown("---\nname: weekly-update\n---\nHi")).toBeNull();
    expect(
      parseSkillMarkdown(skillDoc("../escape", "Nope.", "body")),
    ).toBeNull();
  });
});

describe("skillResourcePathError", () => {
  it("blocks traversal", () => {
    expect(skillResourcePathError("references/style.md")).toBeNull();
    expect(skillResourcePathError("../secret")).not.toBeNull();
    expect(skillResourcePathError("/etc/passwd")).not.toBeNull();
  });
});

describe("workspaceSkillSource", () => {
  it("lists, loads, edits, and removes skills on the computer", async () => {
    const disk = new MemoryWorkspace();
    const source = workspaceSkillSource(disk);

    await disk.writeFile(
      skillFilePath("weekly-update"),
      skillDoc("weekly-update", "Monday status.", "Five bullets."),
    );
    await disk.writeFile(
      "skills/weekly-update/references/voice.md",
      "Short. No fluff.",
    );

    const listed = await source.list();
    expect(listed).toEqual([
      expect.objectContaining({
        name: "weekly-update",
        description: "Monday status.",
        sourceId: "workspace:skills",
      }),
    ]);

    const loaded = await source.load("weekly-update");
    expect(loaded?.body).toContain("Five bullets.");
    expect(loaded?.resources).toEqual([
      expect.objectContaining({
        path: "references/voice.md",
        kind: "reference",
        encoding: "text",
      }),
    ]);
    expect(await source.readResource("weekly-update", "references/voice.md")).toEqual(
      expect.objectContaining({ content: "Short. No fluff." }),
    );

    const before = source.fingerprint;
    await disk.writeFile(
      skillFilePath("weekly-update"),
      skillDoc("weekly-update", "Monday status.", "Three bullets."),
    );
    await source.refresh();
    expect(source.fingerprint).not.toBe(before);
    expect((await source.load("weekly-update"))?.body).toContain("Three bullets.");

    await disk.rm("skills/weekly-update");
    await source.refresh();
    expect(await source.list()).toEqual([]);
    expect(await source.load("weekly-update")).toBeNull();
  });

  it("skips nested folders, broken files, and a missing catalog", async () => {
    const disk = new MemoryWorkspace();
    const source = workspaceSkillSource(disk);
    expect(await source.list()).toEqual([]);

    await disk.writeFile(
      "skills/nested/too-deep/SKILL.md",
      skillDoc("too-deep", "Hidden.", "nope"),
    );
    await disk.writeFile("skills/broken/SKILL.md", "not a skill");
    await source.refresh();
    expect(await source.list()).toEqual([]);
  });

  it("discovers skills from readDir when glob is missing", async () => {
    const disk = new MemoryWorkspace();
    await disk.writeFile(
      skillFilePath("brief"),
      skillDoc("brief", "Write a client brief.", "One page."),
    );
    const dirOnly: SkillWorkspace = {
      readFile: (path) => disk.readFile(path),
      readDir: (path) => disk.readDir(path),
      stat: (path) => disk.stat(path),
    };
    expect(
      (await workspaceSkillSource(dirOnly).list()).map((skill) => skill.name),
    ).toEqual(["brief"]);
  });

  it("caps how many skills the catalog will grow to", async () => {
    const disk = new MemoryWorkspace();
    for (let i = 0; i < MAX_WORKSPACE_SKILLS + 5; i++) {
      const name = `skill-${String(i).padStart(2, "0")}`;
      await disk.writeFile(skillFilePath(name), skillDoc(name, "A playbook.", "Do it."));
    }
    const listed = await workspaceSkillSource(disk).list();
    expect(listed).toHaveLength(MAX_WORKSPACE_SKILLS);
  });
});
