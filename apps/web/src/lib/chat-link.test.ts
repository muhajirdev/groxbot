import { describe, expect, it } from "vitest";
import {
  chatFileOpensKnowledge,
  parseChatHref,
  parseComputerFileHint,
} from "./chat-link";

const ORIGIN = "http://127.0.0.1:5173";

describe("parseChatHref", () => {
  it("treats office-root paths as computer files", () => {
    expect(parseChatHref("expandra/playbook-v0.3.md")).toEqual({
      kind: "path",
      path: "expandra/playbook-v0.3.md",
    });
    expect(parseChatHref("/expandra/playbook-v0.3.md")).toEqual({
      kind: "path",
      path: "expandra/playbook-v0.3.md",
    });
    expect(parseChatHref("./notes/memory.md#top")).toEqual({
      kind: "path",
      path: "notes/memory.md",
    });
  });

  it("keeps http, https, and mailto", () => {
    expect(parseChatHref("https://expandra.ai/playbook")).toEqual({
      kind: "external",
      href: "https://expandra.ai/playbook",
    });
    expect(parseChatHref("mailto:a@b.co")).toEqual({
      kind: "external",
      href: "mailto:a@b.co",
    });
  });

  it("unwraps same-origin file URLs so they are not pages", () => {
    expect(
      parseChatHref("http://127.0.0.1:5173/expandra/playbook-v0.3.md", ORIGIN),
    ).toEqual({
      kind: "path",
      path: "expandra/playbook-v0.3.md",
    });
  });

  it("does not treat same-origin app routes as files", () => {
    expect(parseChatHref("http://127.0.0.1:5173/onboarding", ORIGIN)).toEqual({
      kind: "external",
      href: "http://127.0.0.1:5173/onboarding",
    });
  });

  it("rejects javascript and parent paths", () => {
    expect(parseChatHref("javascript:alert(1)")).toEqual({ kind: "invalid" });
    expect(parseChatHref("../secret.md")).toEqual({ kind: "invalid" });
  });
});

describe("parseComputerFileHint", () => {
  it("opens backtick file paths", () => {
    expect(parseComputerFileHint("essay-car.md")).toBe("essay-car.md");
    expect(parseComputerFileHint("inbox/notes.txt")).toBe("inbox/notes.txt");
    expect(
      parseComputerFileHint("skills/sinemart-receipt-fraud-review/SKILL.md"),
    ).toBe("skills/sinemart-receipt-fraud-review/SKILL.md");
  });

  it("ignores code that is not a file path", () => {
    expect(parseComputerFileHint("const x = 1")).toBeNull();
    expect(parseComputerFileHint("inbox")).toBeNull();
    expect(parseComputerFileHint(".gitignore")).toBeNull();
  });
});

describe("chatFileOpensKnowledge", () => {
  it("opens skills and tasks in the office library", () => {
    expect(
      chatFileOpensKnowledge("skills/sinemart-receipt-fraud-review/SKILL.md"),
    ).toBe(true);
    expect(chatFileOpensKnowledge("SKILL.md")).toBe(true);
    expect(chatFileOpensKnowledge("skills/digest")).toBe(true);
    expect(chatFileOpensKnowledge("tasks/ship-landing/TASK.md")).toBe(true);
    expect(chatFileOpensKnowledge("essay-car.md")).toBe(false);
    expect(chatFileOpensKnowledge("inbox/notes.md")).toBe(false);
  });
});
