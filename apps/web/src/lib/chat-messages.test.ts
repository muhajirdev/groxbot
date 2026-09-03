import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import {
  coalesceAssistantMessages,
  collapseTextParts,
  lastThinkPreview,
  splitQueuedFollowUps,
  textFromMessage,
  usedTools,
  isVisibleChatMessage,
} from "./chat-messages";
import { OFFICE_REVIEW_SOURCE } from "@groxbot/contracts";

function assistant(id: string, ...texts: string[]): UIMessage {
  return {
    id,
    role: "assistant",
    parts: texts.map((text) => ({ type: "text", text })),
  };
}

function user(id: string, text: string): UIMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text }],
  };
}

describe("collapseTextParts", () => {
  it("drops a prefix text part left by stream replay", () => {
    const next = collapseTextParts(
      assistant("a", "Search: grep", "Search: grep\n\nShell"),
    );
    expect(textFromMessage(next)).toBe("Search: grep\n\nShell");
  });
});

describe("coalesceAssistantMessages", () => {
  it("drops a stale stream fragment when the snapshot contains it", () => {
    const search = "Search: grep\n\nShell\n\nMemory";
    const full = `Ah right — skills.\n\nFile wrangling\n\n${search}`;
    const next = coalesceAssistantMessages([
      assistant("stream", search),
      assistant("snap", full),
    ]);
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe("snap");
    expect(textFromMessage(next[0]!)).toBe(full);
  });

  it("drops a later fragment that is already in the previous bubble", () => {
    const full = "Ah right.\n\nSearch: grep";
    const next = coalesceAssistantMessages([
      assistant("snap", full),
      assistant("tail", "Search: grep"),
    ]);
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe("snap");
  });

  it("does not merge distinct assistant turns", () => {
    const next = coalesceAssistantMessages([
      assistant("a", "I can grep the repo."),
      assistant("b", "Want me to write memory.md?"),
    ]);
    expect(next.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("does not merge across a user message", () => {
    const next = coalesceAssistantMessages([
      assistant("a", "Hello"),
      user("u", "and skills?"),
      assistant("b", "Hello — here are skills."),
    ]);
    expect(next.map((m) => m.id)).toEqual(["a", "u", "b"]);
  });
});

describe("usedTools", () => {
  it("ignores step-start, which every turn gets from the AI SDK", () => {
    const message: UIMessage = {
      id: "a",
      role: "assistant",
      parts: [{ type: "step-start" }],
    };
    expect(usedTools(message)).toBe(false);
  });

  it("detects a real workspace tool part", () => {
    const message: UIMessage = {
      id: "a",
      role: "assistant",
      parts: [
        {
          type: "tool-list",
          toolCallId: "1",
          state: "output-available",
          input: {},
          output: [],
        },
      ],
    };
    expect(usedTools(message)).toBe(true);
  });
});

describe("lastThinkPreview", () => {
  it("uses the latest non-empty text", () => {
    expect(
      lastThinkPreview([
        user("u1", "hello there"),
        assistant("a1", "  got it  "),
      ]),
    ).toBe("got it");
  });

  it("ignores the hidden inbox path note", () => {
    expect(
      lastThinkPreview([
        {
          id: "u1",
          role: "user",
          parts: [
            { type: "text", text: "can you read this pdf" },
            { type: "text", text: "On this computer: inbox/a.pdf" },
            {
              type: "file",
              filename: "a.pdf",
              mediaType: "application/pdf",
              url: "inbox/a.pdf",
            },
          ],
        },
      ]),
    ).toBe("can you read this pdf");
  });

  it("ignores the old saved-as sentence", () => {
    expect(
      lastThinkPreview([
        {
          id: "u1",
          role: "user",
          parts: [
            { type: "text", text: "can you read this pdf" },
            {
              type: "text",
              text: "Saved on this computer as inbox/agreement-cas-2026.pdf.",
            },
          ],
        },
      ]),
    ).toBe("can you read this pdf");
  });

  it("skips a hidden office-review nudge and a Skip", () => {
    expect(
      lastThinkPreview([
        assistant("a1", "Filed skills/weekly-update/SKILL.md"),
        {
          id: "u-review",
          role: "user",
          parts: [{ type: "text", text: "Office review." }],
          metadata: { source: OFFICE_REVIEW_SOURCE },
        },
        assistant("a2", "Skip"),
      ]),
    ).toBe("Filed skills/weekly-update/SKILL.md");
  });
});

describe("isVisibleChatMessage", () => {
  it("hides the office-review trigger and Skip", () => {
    expect(
      isVisibleChatMessage({
        id: "u",
        role: "user",
        parts: [{ type: "text", text: "Office review." }],
        metadata: { custom: { source: OFFICE_REVIEW_SOURCE } },
      }),
    ).toBe(false);
    expect(isVisibleChatMessage(assistant("a", "Skip"))).toBe(false);
    expect(
      isVisibleChatMessage(assistant("a", "Saved skills/weekly-update/SKILL.md")),
    ).toBe(true);
  });
});

describe("splitQueuedFollowUps", () => {
  it("does nothing when idle", () => {
    const messages = [
      user("u1", "hi"),
      assistant("a1", "hey"),
      user("u2", "later"),
    ];
    expect(splitQueuedFollowUps(messages, false)).toEqual({
      thread: messages,
      queued: [],
    });
  });

  it("keeps follow-ups after the live assistant", () => {
    const u1 = user("u1", "hi");
    const a1 = assistant("a1", "hey");
    const u2 = user("u2", "and this");
    const next = splitQueuedFollowUps([u1, a1, u2], true);
    expect(next.thread.map((m) => m.id)).toEqual(["u1", "a1"]);
    expect(next.queued.map((m) => m.id)).toEqual(["u2"]);
  });

  it("pulls follow-ups parked before a pinned streaming assistant", () => {
    const u1 = user("u1", "hi");
    const u2 = user("u2", "and this");
    const a1 = assistant("a1", "hey");
    const next = splitQueuedFollowUps([u1, u2, a1], true);
    expect(next.thread.map((m) => m.id)).toEqual(["u1", "a1"]);
    expect(next.queued.map((m) => m.id)).toEqual(["u2"]);
  });

  it("queues extra users before the first assistant token", () => {
    const u1 = user("u1", "hi");
    const u2 = user("u2", "and this");
    const next = splitQueuedFollowUps([u1, u2], true);
    expect(next.thread.map((m) => m.id)).toEqual(["u1"]);
    expect(next.queued.map((m) => m.id)).toEqual(["u2"]);
  });
});
