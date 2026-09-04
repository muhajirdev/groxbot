import { describe, expect, it } from "vitest";
import {
  applyOfficeChunk,
  applyOfficeSocketMessage,
  lastOfficePreview,
  parseOfficeMessages,
  officeSendBody,
  userOfficeMessage,
} from "./office-messages";

describe("parseOfficeMessages", () => {
  it("keeps user and assistant rows", () => {
    const rows = parseOfficeMessages([
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "hello" }],
      },
      { id: "skip", role: "tool" },
    ]);
    expect(rows).toHaveLength(1);
    expect(lastOfficePreview(rows)).toBe("hello");
  });

  it("previews a present card when the assistant has no text", () => {
    expect(
      lastOfficePreview([
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "tool-present",
              input: { $type: "Card", title: "Hiring shortlist" },
            },
          ],
        },
      ]),
    ).toBe("Hiring shortlist");
  });
});

describe("applyOfficeChunk", () => {
  it("appends text-delta onto the live assistant turn", () => {
    const started = applyOfficeChunk([], {
      type: "start",
      messageId: "a1",
    });
    const next = applyOfficeChunk(started, {
      type: "text-delta",
      messageId: "a1",
      delta: "Hi",
    });
    expect(lastOfficePreview(next)).toBe("Hi");
  });
});

describe("applyOfficeSocketMessage", () => {
  it("applies a stream body and clears streaming when done", () => {
    const first = applyOfficeSocketMessage([], {
      type: "cf_agent_use_chat_response",
      id: "r1",
      body: JSON.stringify({ type: "text-delta", delta: "ok" }),
      done: false,
    });
    expect(first.streaming).toBe(true);
    const done = applyOfficeSocketMessage(first.messages, {
      type: "cf_agent_use_chat_response",
      id: "r1",
      done: true,
    });
    expect(done.streaming).toBe(false);
    expect(lastOfficePreview(done.messages)).toBe("ok");
  });
});

describe("officeSendBody", () => {
  it("wraps messages for CF_AGENT_USE_CHAT_REQUEST", () => {
    const payload = JSON.parse(
      officeSendBody([userOfficeMessage({ text: "hi" })]),
    ) as { trigger: string; messages: unknown[] };
    expect(payload.trigger).toBe("submit-message");
    expect(payload.messages).toHaveLength(1);
  });
});
