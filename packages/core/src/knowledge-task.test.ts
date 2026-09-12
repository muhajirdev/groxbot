import { describe, expect, it } from "vitest";
import {
  appendTaskActivity,
  formatTaskMarkdown,
  groupTasksByStatus,
  isKnowledgeTaskActivityFile,
  isKnowledgeTaskFile,
  knowledgeTaskName,
  parseTaskActivity,
  parseTaskMarkdown,
  parseTaskStatus,
  slugFromTitle,
  stampKnowledgeTaskWrite,
  stampTaskMarkdown,
  taskActivityPath,
  taskFilePath,
  uniqueTaskName,
} from "./knowledge-task.js";

describe("task paths", () => {
  it("mirrors skills/<name>/SKILL.md as tasks/<name>/TASK.md", () => {
    expect(taskFilePath("ship-landing")).toBe("tasks/ship-landing/TASK.md");
    expect(taskActivityPath("ship-landing")).toBe(
      "tasks/ship-landing/activity.md",
    );
    expect(isKnowledgeTaskFile("tasks/ship-landing/TASK.md")).toBe(true);
    expect(isKnowledgeTaskFile("skills/ship-landing/SKILL.md")).toBe(false);
    expect(isKnowledgeTaskFile("TASK.md")).toBe(false);
    expect(isKnowledgeTaskFile("tasks/TASK.md")).toBe(false);
    expect(isKnowledgeTaskFile("tasks/ship-landing/notes/TASK.md")).toBe(false);
    expect(isKnowledgeTaskActivityFile("tasks/ship-landing/activity.md")).toBe(
      true,
    );
    expect(knowledgeTaskName("tasks/ship-landing/TASK.md")).toBe(
      "ship-landing",
    );
  });
});

describe("parseTaskMarkdown", () => {
  it("reads YAML name, description, and status", () => {
    const raw = formatTaskMarkdown({
      name: "ship-landing",
      description: "Ship the landing page",
      status: "in_progress",
      body: "Hero first.\n",
    });
    expect(parseTaskMarkdown(raw)).toEqual({
      name: "ship-landing",
      description: "Ship the landing page",
      status: "in_progress",
      body: "Hero first.\n",
    });
  });

  it("round-trips who triggered the task", () => {
    const raw = formatTaskMarkdown({
      name: "ship-landing",
      description: "Ship the landing page",
      status: "todo",
      body: "",
      triggeredBy: "usr_ada",
      triggeredByName: "Ada",
      triggeredAt: "2026-09-12T03:00:00.000Z",
    });
    expect(raw).toMatch(/^triggeredBy: usr_ada$/m);
    expect(parseTaskMarkdown(raw)).toMatchObject({
      name: "ship-landing",
      triggeredBy: "usr_ada",
      triggeredByName: "Ada",
      triggeredAt: "2026-09-12T03:00:00.000Z",
    });
  });

  it("stamps a missing owner and keeps an existing one", () => {
    const blank = formatTaskMarkdown({
      name: "ship-landing",
      description: "Ship it",
      body: "Hero.\n",
    });
    const stamped = stampTaskMarkdown(
      blank,
      { userId: "usr_ada", name: "Ada" },
      "2026-09-12T03:00:00.000Z",
    );
    expect(parseTaskMarkdown(stamped)).toMatchObject({
      triggeredBy: "usr_ada",
      triggeredByName: "Ada",
      triggeredAt: "2026-09-12T03:00:00.000Z",
    });
    const kept = stampTaskMarkdown(
      stamped,
      { userId: "usr_sam", name: "Sam" },
      "2026-09-13T00:00:00.000Z",
    );
    expect(parseTaskMarkdown(kept)).toMatchObject({
      triggeredBy: "usr_ada",
      triggeredByName: "Ada",
      triggeredAt: "2026-09-12T03:00:00.000Z",
    });
  });

  it("defaults an unknown status so cached files still list", () => {
    expect(parseTaskStatus(undefined)).toBe("todo");
    expect(parseTaskStatus("nope")).toBe("todo");
    const raw = `---\nname: ship-landing\ndescription: Ship it\n---\nNotes.\n`;
    expect(parseTaskMarkdown(raw)?.status).toBe("todo");
  });

  it("rejects a file without YAML name + description", () => {
    expect(parseTaskMarkdown("# just a note\n")).toBeNull();
    expect(
      parseTaskMarkdown(`---\nname: Nope\ndescription: Title case name\n---\n`),
    ).toBeNull();
  });
});

describe("task activity", () => {
  it("round-trips comments in the sibling activity.md", () => {
    const first = appendTaskActivity("", {
      at: "2026-09-11T18:00:00.000Z",
      author: "you",
      body: "Let's start with the hero.",
    });
    const next = appendTaskActivity(first, {
      at: "2026-09-11T18:05:00.000Z",
      author: "piper",
      body: "Drafted copy in inbox/.",
    });
    expect(parseTaskActivity(next)).toEqual([
      {
        at: "2026-09-11T18:00:00.000Z",
        author: "you",
        body: "Let's start with the hero.",
      },
      {
        at: "2026-09-11T18:05:00.000Z",
        author: "piper",
        body: "Drafted copy in inbox/.",
      },
    ]);
  });

  it("keeps a multi-line comment until the next heading", () => {
    const raw = `## 2026-09-11T18:00:00.000Z you\nLine one.\n\nLine two.\n`;
    expect(parseTaskActivity(raw)).toEqual([
      {
        at: "2026-09-11T18:00:00.000Z",
        author: "you",
        body: "Line one.\n\nLine two.",
      },
    ]);
  });

  it("records the triggering human on activity lines", () => {
    const raw = appendTaskActivity("", {
      at: "2026-09-12T03:00:00.000Z",
      author: "Ada",
      authorId: "usr_ada",
      body: "Asked for the landing page.",
    });
    expect(raw).toMatch(/^## 2026-09-12T03:00:00.000Z Ada @usr_ada$/m);
    expect(parseTaskActivity(raw)).toEqual([
      {
        at: "2026-09-12T03:00:00.000Z",
        author: "Ada",
        authorId: "usr_ada",
        body: "Asked for the landing page.",
      },
    ]);
    const stamped = stampKnowledgeTaskWrite(
      "tasks/ship-landing/activity.md",
      "## 2026-09-12T03:05:00.000Z piper\nDrafted copy.\n",
      { userId: "usr_ada", name: "Ada" },
    );
    expect(parseTaskActivity(stamped)).toEqual([
      {
        at: "2026-09-12T03:05:00.000Z",
        author: "Ada",
        authorId: "usr_ada",
        body: "Drafted copy.",
      },
    ]);
  });
});

describe("slugFromTitle", () => {
  it("makes a skill-like folder name", () => {
    expect(slugFromTitle("Ship the landing page")).toBe(
      "ship-the-landing-page",
    );
    expect(slugFromTitle("???")).toBe("");
  });

  it("avoids colliding names", () => {
    expect(uniqueTaskName("ship-landing", new Set(["ship-landing"]))).toBe(
      "ship-landing-2",
    );
    expect(uniqueTaskName("Ship landing", new Set())).toBe("ship-landing");
  });
});

describe("groupTasksByStatus", () => {
  it("puts each task in one column", () => {
    const grouped = groupTasksByStatus([
      { id: "a", status: "todo" },
      { id: "b", status: "in_progress" },
      { id: "c", status: "in_progress" },
      { id: "d" },
    ]);
    expect(grouped.todo.map((row) => row.id)).toEqual(["a", "d"]);
    expect(grouped.in_progress.map((row) => row.id)).toEqual(["b", "c"]);
    expect(grouped.done).toEqual([]);
  });
});
