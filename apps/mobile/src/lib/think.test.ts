import { describe, expect, it } from "vitest";
import {
  applyThinkChunk,
  applyThinkSocketMessage,
  lastThinkPreview,
  parseThinkMessages,
  thinkSendBody,
  userThinkMessage,
} from "./think";

describe("parseThinkMessages", () => {
  it("keeps user and assistant rows", () => {
    const rows = parseThinkMessages([
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "hello" }],
      },
      { id: "skip", role: "tool" },
    ]);
    expect(rows).toHaveLength(1);
    expect(lastThinkPreview(rows)).toBe("hello");
  });
});

describe("applyThinkChunk", () => {
  it("appends text-delta onto the live assistant turn", () => {
    const started = applyThinkChunk([], {
      type: "start",
      messageId: "a1",
    });
    const next = applyThinkChunk(started, {
      type: "text-delta",
      messageId: "a1",
      delta: "Hi",
    });
    expect(lastThinkPreview(next)).toBe("Hi");
  });
});

describe("applyThinkSocketMessage", () => {
  it("applies a stream body and clears streaming when done", () => {
    const first = applyThinkSocketMessage([], {
      type: "cf_agent_use_chat_response",
      id: "r1",
      body: JSON.stringify({ type: "text-delta", delta: "ok" }),
      done: false,
    });
    expect(first.streaming).toBe(true);
    const done = applyThinkSocketMessage(first.messages, {
      type: "cf_agent_use_chat_response",
      id: "r1",
      done: true,
    });
    expect(done.streaming).toBe(false);
    expect(lastThinkPreview(done.messages)).toBe("ok");
  });
});

describe("thinkSendBody", () => {
  it("wraps messages for CF_AGENT_USE_CHAT_REQUEST", () => {
    const payload = JSON.parse(
      thinkSendBody([userThinkMessage({ text: "hi" })]),
    ) as { trigger: string; messages: unknown[] };
    expect(payload.trigger).toBe("submit-message");
    expect(payload.messages).toHaveLength(1);
  });
});
