import { describe, expect, it } from "vitest";
import { formatSkillMarkdown, type KnowledgeDisk, type KnowledgeObject } from "./knowledge.js";
import {
  SkillImportError,
  createSkillImportHttp,
  discoverSkillMarkdownPaths,
  importOfficeSkills,
  parseSkillImportSource,
  type SkillImportHttp,
} from "./skill-import.js";

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

class MemoryHttp implements SkillImportHttp {
  json = new Map<string, unknown>();
  bytes = new Map<string, Uint8Array>();

  async getJson(url: string): Promise<unknown> {
    if (!this.json.has(url)) throw new SkillImportError(`missing json ${url}`);
    return this.json.get(url);
  }

  async getBytes(url: string): Promise<Uint8Array> {
    const body = this.bytes.get(url);
    if (!body) throw new SkillImportError(`missing bytes ${url}`);
    return body;
  }

  skill(owner: string, repo: string, ref: string, path: string, text: string) {
    this.bytes.set(
      `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`,
      new TextEncoder().encode(text),
    );
  }
}

function skillDoc(name: string, description: string, body = "Do it."): string {
  return formatSkillMarkdown({ name, description, body });
}

function githubTree(
  http: MemoryHttp,
  owner: string,
  repo: string,
  ref: string,
  files: string[],
) {
  http.json.set(`https://api.github.com/repos/${owner}/${repo}`, {
    default_branch: ref,
  });
  http.json.set(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
    {
      tree: files.map((path) => ({ path, type: "blob" })),
    },
  );
}

describe("parseSkillImportSource", () => {
  it("reads owner/repo and an optional skill name", () => {
    expect(parseSkillImportSource("vercel-labs/agent-skills")).toEqual({
      owner: "vercel-labs",
      repo: "agent-skills",
      skill: undefined,
    });
    expect(
      parseSkillImportSource("vercel-labs/agent-skills/web-design-guidelines"),
    ).toEqual({
      owner: "vercel-labs",
      repo: "agent-skills",
      skill: "web-design-guidelines",
    });
  });

  it("reads GitHub, raw, and skills.sh URLs", () => {
    expect(
      parseSkillImportSource(
        "github.com/vercel-labs/agent-skills/tree/main/skills/foo",
      ),
    ).toEqual({
      owner: "vercel-labs",
      repo: "agent-skills",
      ref: "main",
      path: "skills/foo",
    });
    expect(
      parseSkillImportSource(
        "https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines",
      ),
    ).toEqual({
      owner: "vercel-labs",
      repo: "agent-skills",
      ref: "main",
      path: "skills/web-design-guidelines",
    });
    expect(
      parseSkillImportSource(
        "https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/foo/SKILL.md",
      ),
    ).toEqual({
      owner: "vercel-labs",
      repo: "agent-skills",
      ref: "main",
      path: "skills/foo/SKILL.md",
    });
    expect(
      parseSkillImportSource("https://skills.sh/vercel-labs/agent-skills"),
    ).toMatchObject({ owner: "vercel-labs", repo: "agent-skills" });
  });

  it("rejects non-GitHub hosts and credentials", () => {
    expect(() => parseSkillImportSource("https://evil.test/SKILL.md")).toThrow(
      SkillImportError,
    );
    expect(() =>
      parseSkillImportSource("https://user:pass@github.com/acme/skills"),
    ).toThrow(/not allowed/);
    expect(() => parseSkillImportSource("http://github.com/acme/skills")).toThrow(
      /HTTPS/,
    );
  });
});

describe("discoverSkillMarkdownPaths", () => {
  it("finds skills/ folders and skips nested copies", () => {
    expect(
      discoverSkillMarkdownPaths([
        "README.md",
        "SKILL.md",
        "skills/digest/SKILL.md",
        "skills/digest/nested/SKILL.md",
        "skills/cat/brief/SKILL.md",
        "notes/voice.md",
      ]),
    ).toEqual([
      "SKILL.md",
      "skills/cat/brief/SKILL.md",
      "skills/digest/SKILL.md",
    ]);
  });

  it("scopes to a GitHub folder", () => {
    expect(
      discoverSkillMarkdownPaths(
        ["skills/digest/SKILL.md", "skills/other/SKILL.md"],
        "skills/digest",
      ),
    ).toEqual(["skills/digest/SKILL.md"]);
  });
});

describe("importOfficeSkills", () => {
  it("writes playbooks under skills/<name>/", async () => {
    const disk = new MemoryKnowledge();
    const http = new MemoryHttp();
    githubTree(http, "acme", "playbooks", "main", [
      "skills/weekly-update/SKILL.md",
      "skills/weekly-update/references/voice.md",
      "README.md",
    ]);
    http.skill(
      "acme",
      "playbooks",
      "main",
      "skills/weekly-update/SKILL.md",
      skillDoc("weekly-update", "Five bullets."),
    );
    http.skill(
      "acme",
      "playbooks",
      "main",
      "skills/weekly-update/references/voice.md",
      "Short.",
    );

    const result = await importOfficeSkills(
      disk,
      "ws_office",
      { source: "acme/playbooks" },
      http,
    );
    expect(result.imported).toEqual([
      {
        name: "weekly-update",
        path: "skills/weekly-update/SKILL.md",
        description: "Five bullets.",
      },
    ]);
    expect(await disk.getText("ws_office/skills/weekly-update/SKILL.md")).toMatch(
      /Five bullets/,
    );
    expect(
      await disk.getText("ws_office/skills/weekly-update/references/voice.md"),
    ).toBe("Short.");
  });

  it("skips a name that is already in the office", async () => {
    const disk = new MemoryKnowledge();
    await disk.put(
      "ws_office/playbooks/weekly-update/SKILL.md",
      new TextEncoder().encode(skillDoc("weekly-update", "Old.")),
    );
    const http = new MemoryHttp();
    githubTree(http, "acme", "playbooks", "main", [
      "skills/weekly-update/SKILL.md",
    ]);
    http.skill(
      "acme",
      "playbooks",
      "main",
      "skills/weekly-update/SKILL.md",
      skillDoc("weekly-update", "New."),
    );

    const result = await importOfficeSkills(
      disk,
      "ws_office",
      { source: "acme/playbooks" },
      http,
    );
    expect(result.imported).toEqual([]);
    expect(result.skipped).toEqual([
      { name: "weekly-update", reason: "Already in the office." },
    ]);
    expect(await disk.getText("ws_office/playbooks/weekly-update/SKILL.md")).toMatch(
      /Old/,
    );
  });

  it("imports one named skill from a repo with many", async () => {
    const disk = new MemoryKnowledge();
    const http = new MemoryHttp();
    githubTree(http, "acme", "playbooks", "main", [
      "skills/alpha/SKILL.md",
      "skills/beta/SKILL.md",
    ]);
    http.skill(
      "acme",
      "playbooks",
      "main",
      "skills/alpha/SKILL.md",
      skillDoc("alpha", "A."),
    );
    http.skill(
      "acme",
      "playbooks",
      "main",
      "skills/beta/SKILL.md",
      skillDoc("beta", "B."),
    );

    const result = await importOfficeSkills(
      disk,
      "ws_office",
      { source: "acme/playbooks/beta" },
      http,
    );
    expect(result.imported.map((row) => row.name)).toEqual(["beta"]);
    expect(disk.files.has("ws_office/skills/alpha/SKILL.md")).toBe(false);
  });
});

describe("createSkillImportHttp", () => {
  it("refuses a redirect off GitHub", async () => {
    const http = createSkillImportHttp(async () => {
      return {
        ok: true,
        status: 200,
        url: "https://evil.test/SKILL.md",
        headers: new Headers(),
        arrayBuffer: async () => new ArrayBuffer(0),
      } as Response;
    });
    await expect(
      http.getBytes(
        "https://raw.githubusercontent.com/acme/playbooks/main/SKILL.md",
      ),
    ).rejects.toThrow(/GitHub/);
  });
});
