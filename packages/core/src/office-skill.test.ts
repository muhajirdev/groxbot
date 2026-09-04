import { describe, expect, it } from "vitest";
import {
  formatSkillMarkdown,
  type KnowledgeDisk,
  type KnowledgeObject,
} from "./knowledge.js";
import { runOfficeSkill, loadOfficeSkillCatalog, SKILL_TOOL_NAME } from "./office-skill.js";

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

function doc(name: string, description: string, body: string): string {
  return formatSkillMarkdown({ name, description, body });
}

describe("runOfficeSkill", () => {
  it("is named skill_manage", () => {
    expect(SKILL_TOOL_NAME).toBe("skill_manage");
  });

  it("creates a SKILL.md under skills/<name>/", async () => {
    const disk = new MemoryKnowledge();
    const content = doc("weekly-update", "Friday digest.", "Ask for numbers.");
    await expect(
      runOfficeSkill(disk, OFFICE, {
        action: "create",
        name: "weekly-update",
        content,
      }),
    ).resolves.toEqual({
      ok: true,
      action: "create",
      path: "skills/weekly-update/SKILL.md",
    });
    await expect(
      disk.getText("ws_office/skills/weekly-update/SKILL.md"),
    ).resolves.toBe(content);
  });

  it("refuses create when the skill exists", async () => {
    const disk = new MemoryKnowledge();
    const content = doc("weekly-update", "Friday digest.", "Ask for numbers.");
    await runOfficeSkill(disk, OFFICE, {
      action: "create",
      name: "weekly-update",
      content,
    });
    await expect(
      runOfficeSkill(disk, OFFICE, {
        action: "create",
        name: "weekly-update",
        content,
      }),
    ).resolves.toMatchObject({ ok: false, message: expect.stringMatching(/exists/i) });
  });

  it("patches a unique snippet", async () => {
    const disk = new MemoryKnowledge();
    await runOfficeSkill(disk, OFFICE, {
      action: "create",
      name: "weekly-update",
      content: doc("weekly-update", "Friday digest.", "Ask for numbers."),
    });
    const patched = await runOfficeSkill(disk, OFFICE, {
      action: "patch",
      name: "weekly-update",
      oldText: "Ask for numbers.",
      newText: "Ask for numbers. Cite the sheet.",
    });
    expect(patched).toEqual({
      ok: true,
      action: "patch",
      path: "skills/weekly-update/SKILL.md",
    });
    const next = await disk.getText("ws_office/skills/weekly-update/SKILL.md");
    expect(next).toContain("Cite the sheet.");
  });

  it("deletes the skill folder", async () => {
    const disk = new MemoryKnowledge();
    await runOfficeSkill(disk, OFFICE, {
      action: "create",
      name: "weekly-update",
      content: doc("weekly-update", "Friday digest.", "Ask for numbers."),
    });
    await expect(
      runOfficeSkill(disk, OFFICE, { action: "delete", name: "weekly-update" }),
    ).resolves.toMatchObject({ ok: true, action: "delete" });
    await expect(
      disk.getText("ws_office/skills/weekly-update/SKILL.md"),
    ).resolves.toBeNull();
  });

  it("rejects a YAML name that does not match", async () => {
    const disk = new MemoryKnowledge();
    await expect(
      runOfficeSkill(disk, OFFICE, {
        action: "create",
        name: "weekly-update",
        content: doc("other", "Nope.", "Body."),
      }),
    ).resolves.toMatchObject({ ok: false });
  });
});

describe("loadOfficeSkillCatalog", () => {
  it("lists office SKILL.md name, description, and path", async () => {
    const disk = new MemoryKnowledge();
    await runOfficeSkill(disk, OFFICE, {
      action: "create",
      name: "weekly-update",
      content: doc("weekly-update", "Friday digest.", "Ask for numbers."),
    });
    await expect(loadOfficeSkillCatalog(disk, OFFICE)).resolves.toEqual([
      {
        name: "weekly-update",
        description: "Friday digest.",
        path: "skills/weekly-update/SKILL.md",
        directory: "skills/weekly-update",
        body: "Ask for numbers.",
      },
    ]);
  });
});
