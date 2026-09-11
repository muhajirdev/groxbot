import { describe, expect, it } from "vitest";
import type { KnowledgeDisk, KnowledgeObject } from "./knowledge.js";
import { formatTaskMarkdown } from "./knowledge-task.js";
import { listKnowledgeTasks } from "./knowledge-tasks.js";

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

describe("listKnowledgeTasks", () => {
  it("lists TASK.md files under tasks/ and skips rooms or skills", async () => {
    const disk = new MemoryKnowledge();
    await disk.put(
      "ws_office/tasks/ship-landing/TASK.md",
      formatTaskMarkdown({
        name: "ship-landing",
        description: "Ship the landing page",
        status: "in_progress",
        body: "Hero first.",
      }),
    );
    await disk.put(
      "ws_office/tasks/ship-landing/activity.md",
      "## 2026-09-11T18:00:00.000Z you\nStart with the hero.\n",
    );
    await disk.put(
      "ws_office/skills/weekly-update/SKILL.md",
      "---\nname: weekly-update\ndescription: Friday digest.\n---\nAsk.\n",
    );
    await disk.put("ws_office/how-we-work/voice.md", "Be brief.\n");

    await expect(listKnowledgeTasks(disk, OFFICE)).resolves.toEqual({
      tasks: [
        {
          name: "ship-landing",
          description: "Ship the landing page",
          status: "in_progress",
          path: "tasks/ship-landing/TASK.md",
          directory: "tasks/ship-landing",
          activityPath: "tasks/ship-landing/activity.md",
          body: "Hero first.",
        },
      ],
      truncated: false,
    });
  });

  it("skips a TASK.md whose YAML name does not match the folder", async () => {
    const disk = new MemoryKnowledge();
    await disk.put(
      "ws_office/tasks/ship-landing/TASK.md",
      formatTaskMarkdown({
        name: "other",
        description: "Nope",
        body: "",
      }),
    );
    await expect(listKnowledgeTasks(disk, OFFICE)).resolves.toEqual({
      tasks: [],
      truncated: false,
    });
  });
});
