import { describe, expect, it } from "vitest";
import {
  createSkillsShSearchHttp,
  formatSkillsShInstalls,
  mapSkillsShHit,
  parseSkillsShSearch,
  readSkillsStoreSkill,
  resolveSkillsStoreListing,
  type SkillsShSearchHttp,
  searchSkillsStore,
  skillsShInstallSource,
  skillsShSearchUrl,
  skillsShTrust,
} from "./skills-sh.js";

describe("skillsShSearchUrl", () => {
  it("builds the legacy find endpoint", () => {
    expect(skillsShSearchUrl("pdf", { limit: 5, owner: "anthropics" })).toBe(
      "https://skills.sh/api/search?q=pdf&limit=5&owner=anthropics",
    );
  });
});

describe("mapSkillsShHit", () => {
  it("maps a directory hit to a store listing", () => {
    const row = mapSkillsShHit({
      id: "anthropics/skills/pdf",
      skillId: "pdf",
      name: "pdf",
      installs: 192_451,
      source: "anthropics/skills",
    });
    expect(row).toMatchObject({
      id: "anthropics/skills/pdf",
      name: "pdf",
      source: "anthropics/skills/pdf",
      category: "Skills",
      trust: "trusted",
      homepage: "https://skills.sh/anthropics/skills/pdf",
    });
    expect(row.blurb).toMatch(/192\.5K installs/);
  });

  it("marks unknown owners as community", () => {
    expect(
      mapSkillsShHit({
        id: "someone/repo/tool",
        name: "tool",
        installs: 12,
        source: "someone/repo",
      }).trust,
    ).toBe("community");
  });
});

describe("skillsShInstallSource", () => {
  it("prefers a full owner/repo/skill id when present", () => {
    expect(
      skillsShInstallSource({
        id: "vercel-labs/agent-skills/vercel-react-best-practices",
        name: "vercel-react-best-practices",
        installs: 1,
        source: "vercel-labs/agent-skills",
      }),
    ).toBe("vercel-labs/agent-skills/vercel-react-best-practices");
  });
});

describe("parseSkillsShSearch", () => {
  it("keeps valid hits and drops junk", () => {
    expect(
      parseSkillsShSearch({
        skills: [
          {
            id: "anthropics/skills/pdf",
            name: "pdf",
            source: "anthropics/skills",
            installs: 10,
          },
          { id: "", name: "x", source: "a/b" },
          null,
        ],
      }),
    ).toEqual([
      {
        id: "anthropics/skills/pdf",
        name: "pdf",
        source: "anthropics/skills",
        skillId: undefined,
        installs: 10,
      },
    ]);
  });
});

describe("searchSkillsStore", () => {
  it("returns curated rows for empty or one-character queries", async () => {
    const empty = await searchSkillsStore("", { limit: 8 });
    expect(empty.source).toBe("curated");
    expect(empty.skills.length).toBeGreaterThan(0);

    const short = await searchSkillsStore("p", {
      limit: 8,
      category: "Documents",
    });
    expect(short.source).toBe("curated");
    expect(short.skills.every((row) => row.category === "Documents")).toBe(
      true,
    );
    expect(short.skills.some((row) => row.id === "anthropic-pdf")).toBe(true);
  });

  it("merges curated with directory hits", async () => {
    const http: SkillsShSearchHttp = {
      async getJson() {
        return {
          skills: [
            {
              id: "openai/skills/pdf",
              skillId: "pdf",
              name: "pdf",
              source: "openai/skills",
              installs: 12_000,
            },
            {
              id: "anthropics/skills/pdf",
              skillId: "pdf",
              name: "pdf",
              source: "anthropics/skills",
              installs: 190_000,
            },
          ],
        };
      },
    };
    const found = await searchSkillsStore("pdf", { limit: 8, http });
    expect(found.source).toBe("directory");
    expect(found.skills[0]?.id).toBe("anthropic-pdf");
    expect(found.skills.some((row) => row.id === "openai/skills/pdf")).toBe(
      true,
    );
  });

  it("falls back to curated when the directory is down", async () => {
    const http: SkillsShSearchHttp = {
      async getJson() {
        throw new Error("down");
      },
    };
    const found = await searchSkillsStore("pdf", { limit: 8, http });
    expect(found.source).toBe("curated");
    expect(found.skills.some((row) => row.id === "anthropic-pdf")).toBe(true);
  });
});

describe("resolveSkillsStoreListing", () => {
  it("resolves curated and directory ids", () => {
    expect(resolveSkillsStoreListing("anthropic-pdf")?.source).toBe(
      "anthropics/skills/pdf",
    );
    expect(resolveSkillsStoreListing("openai/skills/create-pr")).toMatchObject({
      id: "openai/skills/create-pr",
      source: "openai/skills/create-pr",
      trust: "trusted",
    });
    expect(resolveSkillsStoreListing("missing")).toBeUndefined();
    expect(resolveSkillsStoreListing("only/two")).toBeUndefined();
  });
});

describe("readSkillsStoreSkill", () => {
  it("reads a searched directory listing without installing it", async () => {
    const http = {
      async getJson(url: string) {
        if (url === "https://api.github.com/repos/openai/skills") {
          return { default_branch: "main" };
        }
        if (
          url ===
          "https://api.github.com/repos/openai/skills/git/trees/main?recursive=1"
        ) {
          return {
            tree: [
              {
                path: "skills/create-pr/SKILL.md",
                type: "blob",
              },
            ],
          };
        }
        throw new Error(`Unexpected URL: ${url}`);
      },
      async getBytes(url: string) {
        expect(url).toBe(
          "https://raw.githubusercontent.com/openai/skills/main/skills/create-pr/SKILL.md",
        );
        return new TextEncoder().encode(
          "---\nname: create-pr\ndescription: Open a pull request.\n---\n\n# Create a PR",
        );
      },
    };

    await expect(
      readSkillsStoreSkill("openai/skills/create-pr", { http }),
    ).resolves.toMatchObject({
      id: "openai/skills/create-pr",
      source: "openai/skills/create-pr",
      name: "create-pr",
      content: expect.stringContaining("# Create a PR"),
    });
  });
});

describe("helpers", () => {
  it("formats installs and trust", () => {
    expect(formatSkillsShInstalls(1)).toBe("1 install");
    expect(formatSkillsShInstalls(1500)).toBe("1.5K installs");
    expect(skillsShTrust("anthropics")).toBe("trusted");
    expect(skillsShTrust("random")).toBe("community");
  });

  it("builds a fetch http client", async () => {
    const http = createSkillsShSearchHttp(async () =>
      Response.json({ skills: [] }),
    );
    await expect(
      http.getJson("https://skills.sh/api/search?q=x"),
    ).resolves.toEqual({ skills: [] });
  });
});
