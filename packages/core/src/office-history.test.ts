import { OFFICE_INTRO_SOURCE, OFFICE_REVIEW_SKIP, OFFICE_REVIEW_SOURCE } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  MAX_OFFICE_HISTORY_DOCS,
  OfficeHistoryError,
  searchOfficeHistory,
} from "./office-history.js";
import type { PiBoundMessage } from "./pi-transcript.js";

function user(
  id: string,
  content: string,
  extra?: { metadata?: unknown; timestamp?: number },
): PiBoundMessage {
  return {
    id,
    message: {
      role: "user",
      content,
      timestamp: extra?.timestamp ?? 1,
    },
    metadata: extra?.metadata,
  };
}

function assistant(id: string, text: string, timestamp = 2): PiBoundMessage {
  return {
    id,
    message: {
      role: "assistant",
      content: [{ type: "text", text }],
      timestamp,
    },
  };
}

describe("searchOfficeHistory", () => {
  it("ranks this thread’s user and assistant text", () => {
    const found = searchOfficeHistory(
      [
        user("u1", "We picked Neon for Postgres."),
        assistant("a1", "Noted. Neon it is."),
        user("u2", "Ship Friday."),
        assistant("a2", "I'll ship Friday."),
      ],
      "neon postgres",
    );
    expect(found.truncated).toBe(false);
    expect(found.hits[0]?.id).toBe("u1");
    expect(found.hits[0]?.role).toBe("user");
    expect(found.hits[0]?.snippet).toMatch(/Neon/);
  });

  it("skips tool results, hidden review turns, and empty assistant tool-only rows", () => {
    const found = searchOfficeHistory(
      [
        user("u1", "list the desk"),
        {
          id: "a1",
          message: {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "c1",
                name: "list",
                arguments: { path: "/" },
              },
            ],
            timestamp: 2,
          },
        },
        {
          id: "t1",
          message: {
            role: "toolResult",
            toolCallId: "c1",
            toolName: "list",
            content: [{ type: "text", text: "secret neon token in a tool dump" }],
            isError: false,
            timestamp: 3,
          },
        },
        user("u-review", "Office review.", {
          metadata: { custom: { source: OFFICE_REVIEW_SOURCE } },
        }),
        assistant("a-skip", OFFICE_REVIEW_SKIP),
        assistant("a2", "Empty desk."),
      ],
      "neon",
    );
    expect(found.hits.map((row) => row.id)).toEqual([]);
  });

  it("skips a hidden hire-intro kick and keeps the greeting", () => {
    const found = searchOfficeHistory(
      [
        user("u-intro", "Office intro. Become Alex Hormozi.", {
          metadata: { custom: { source: OFFICE_INTRO_SOURCE } },
        }),
        assistant("a-hi", "I'm Hormozi. What's the offer?"),
      ],
      "hormozi",
    );
    expect(found.hits.map((row) => row.id)).toEqual(["a-hi"]);
  });

  it("can ignore the latest user turn so the live question is not a hit", () => {
    const found = searchOfficeHistory(
      [
        user("u1", "Deploy Friday after the neon cutover."),
        assistant("a1", "Will do."),
        user("u2", "What did we say about Friday?"),
      ],
      "friday",
      { excludeLastUser: true },
    );
    expect(found.hits.map((row) => row.id)).toEqual(["u1"]);
  });

  it("caps the index at the newest 800 searchable turns", () => {
    const messages: PiBoundMessage[] = [];
    for (let i = 0; i < MAX_OFFICE_HISTORY_DOCS + 3; i++) {
      messages.push(user(`u${i}`, i === 0 ? "alpha unique origin" : `turn ${i}`));
      messages.push(assistant(`a${i}`, `ack ${i}`));
    }
    const found = searchOfficeHistory(messages, "alpha unique origin");
    expect(found.truncated).toBe(true);
    expect(found.hits).toEqual([]);
  });

  it("rejects an empty query", () => {
    expect(() => searchOfficeHistory([user("u1", "hi")], "   ")).toThrow(
      OfficeHistoryError,
    );
  });
});
