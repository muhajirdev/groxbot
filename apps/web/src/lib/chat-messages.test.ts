import { OFFICE_INTRO_SOURCE, OFFICE_REVIEW_SOURCE } from "@groxbot/contracts";
import type { PiProjectedMessage } from "@groxbot/core/browser";
import { describe, expect, it } from "vitest";
import {
  coalesceAssistantMessages,
  collapseTextParts,
  isVisibleChatMessage,
  lastOfficePreview,
  splitQueuedFollowUps,
  textFromMessage,
  usedTools,
} from "./chat-messages";

function assistant(id: string, ...texts: string[]): PiProjectedMessage {
  return {
    id,
    role: "assistant",
    content: texts.map((text) => ({ type: "text", text })),
  };
}

function user(id: string, text: string): PiProjectedMessage {
  return {
    id,
    role: "user",
    content: [{ type: "text", text }],
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
  it("detects a projected tool-call part", () => {
    const message: PiProjectedMessage = {
      id: "a",
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "list",
          args: {},
          argsText: "{}",
          result: [],
        },
      ],
    };
    expect(usedTools(message)).toBe(true);
  });
});

describe("lastOfficePreview", () => {
  it("uses the latest non-empty text", () => {
    expect(
      lastOfficePreview([
        user("u1", "hello there"),
        assistant("a1", "  got it  "),
      ]),
    ).toBe("got it");
  });

  it("ignores the hidden inbox path note", () => {
    expect(
      lastOfficePreview([
        {
          id: "u1",
          role: "user",
          content: [
            { type: "text", text: "can you read this pdf" },
            { type: "text", text: "On this computer: inbox/a.pdf" },
          ],
        },
      ]),
    ).toBe("can you read this pdf");
  });

  it("uses a present card title when the assistant has no text", () => {
    expect(
      lastOfficePreview([
        {
          id: "a1",
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "1",
              toolName: "present",
              args: { $type: "Card", title: "Hiring shortlist" },
              argsText: "{}",
            },
          ],
        },
      ]),
    ).toBe("Hiring shortlist");
  });

  it("skips a hidden hire-intro nudge and keeps the greeting", () => {
    expect(
      lastOfficePreview([
        {
          id: "u-intro",
          role: "user",
          content: [{ type: "text", text: "Office intro. Become Alex Hormozi." }],
          metadata: { custom: { source: OFFICE_INTRO_SOURCE } },
        },
        assistant("a1", "I'm Hormozi. What's the offer?"),
      ]),
    ).toBe("I'm Hormozi. What's the offer?");
  });

  it("skips a hidden office-review nudge and a Skip", () => {
    expect(
      lastOfficePreview([
        assistant("a1", "Filed skills/weekly-update/SKILL.md"),
        {
          id: "u-review",
          role: "user",
          content: [{ type: "text", text: "Office review." }],
          metadata: { custom: { source: OFFICE_REVIEW_SOURCE } },
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
        content: [{ type: "text", text: "Office review." }],
        metadata: { custom: { source: OFFICE_REVIEW_SOURCE } },
      }),
    ).toBe(false);
    expect(isVisibleChatMessage(assistant("a", "Skip"))).toBe(false);
    expect(
      isVisibleChatMessage(
        assistant("a", "Saved skills/weekly-update/SKILL.md"),
      ),
    ).toBe(true);
  });

  it("hides the hire-intro trigger and keeps the greeting", () => {
    expect(
      isVisibleChatMessage({
        id: "u",
        role: "user",
        content: [{ type: "text", text: "Office intro. Become Alex Hormozi." }],
        metadata: { custom: { source: OFFICE_INTRO_SOURCE } },
      }),
    ).toBe(false);
    expect(
      isVisibleChatMessage(
        assistant("a", "I'm Hormozi. What's the offer?"),
      ),
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
