import { OFFICE_INTRO_SOURCE, OFFICE_REVIEW_SOURCE } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  isVisibleProjectedMessage,
  lastProjectedPreview,
  projectPiBoundMessages,
} from "./pi-projection.js";
import type { PiBoundMessage } from "./pi-transcript.js";

describe("projectPiBoundMessages", () => {
  it("folds assistant + toolResult into one tool-call bubble", () => {
    const messages: PiBoundMessage[] = [
      {
        id: "u1",
        message: { role: "user", content: "list files", timestamp: 1 },
      },
      {
        id: "a1",
        message: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "c1",
              name: "present",
              arguments: { $type: "Card", title: "Hiring shortlist" },
            },
          ],
          timestamp: 2,
          stopReason: "toolUse",
        },
      },
      {
        id: "t1",
        message: {
          role: "toolResult",
          toolCallId: "c1",
          toolName: "present",
          content: [{ type: "text", text: '{"ok":true}' }],
          isError: false,
          timestamp: 3,
        },
      },
      {
        id: "a2",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Done." }],
          timestamp: 4,
          stopReason: "stop",
        },
      },
    ];
    const projected = projectPiBoundMessages(messages);
    expect(projected.map((row) => row.role)).toEqual(["user", "assistant"]);
    expect(projected[1]?.id).toBe("a1");
    expect(projected[1]?.content).toEqual([
      expect.objectContaining({
        type: "tool-call",
        toolCallId: "c1",
        toolName: "present",
        result: '{"ok":true}',
      }),
      { type: "text", text: "Done." },
    ]);
    expect(lastProjectedPreview(projected)).toBe("Done.");
  });

  it("keeps one tool-call part when consecutive assistants repeat the same id", () => {
    const projected = projectPiBoundMessages([
      {
        id: "a1",
        message: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call_dup",
              name: "list",
              arguments: { path: "/" },
            },
          ],
          timestamp: 1,
          stopReason: "toolUse",
        },
      },
      {
        id: "t1",
        message: {
          role: "toolResult",
          toolCallId: "call_dup",
          toolName: "list",
          content: [{ type: "text", text: "[]" }],
          isError: false,
          timestamp: 2,
        },
      },
      {
        id: "a1-stream",
        message: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call_dup",
              name: "list",
              arguments: { path: "/" },
            },
            { type: "text", text: "Empty." },
          ],
          timestamp: 3,
          stopReason: "stop",
        },
      },
    ]);
    const tools = projected[0]?.content.filter(
      (part) => part.type === "tool-call",
    );
    expect(tools).toEqual([
      expect.objectContaining({
        type: "tool-call",
        toolCallId: "call_dup",
        result: "[]",
      }),
    ]);
    expect(projected[0]?.content).toContainEqual({
      type: "text",
      text: "Empty.",
    });
  });

  it("uses a present card title when the assistant has no text", () => {
    const projected = projectPiBoundMessages([
      {
        id: "a1",
        message: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "c1",
              name: "present",
              arguments: { $type: "Card", title: "Hiring shortlist" },
            },
          ],
          timestamp: 1,
          stopReason: "stop",
        },
      },
    ]);
    expect(lastProjectedPreview(projected)).toBe("Hiring shortlist");
  });

  it("hides office-review trigger and Skip", () => {
    expect(
      isVisibleProjectedMessage({
        id: "u",
        role: "user",
        content: [{ type: "text", text: "Office review." }],
        metadata: { custom: { source: OFFICE_REVIEW_SOURCE } },
      }),
    ).toBe(false);
    expect(
      isVisibleProjectedMessage({
        id: "a",
        role: "assistant",
        content: [{ type: "text", text: "Skip" }],
      }),
    ).toBe(false);
  });

  it("hides the hire-intro trigger and keeps the greeting", () => {
    expect(
      isVisibleProjectedMessage({
        id: "u",
        role: "user",
        content: [{ type: "text", text: "Office intro. Become Alex Hormozi." }],
        metadata: { custom: { source: OFFICE_INTRO_SOURCE } },
      }),
    ).toBe(false);
    expect(
      isVisibleProjectedMessage({
        id: "a",
        role: "assistant",
        content: [{ type: "text", text: "I'm Hormozi. What's the offer?" }],
      }),
    ).toBe(true);
  });

  it("keeps two table speakers in separate bubbles", () => {
    const projected = projectPiBoundMessages([
      {
        id: "a1",
        metadata: {
          custom: { speaker: { botId: "steve", name: "Steve Jobs" } },
        },
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Stay hungry." }],
          timestamp: 1,
          stopReason: "stop",
        },
      },
      {
        id: "a2",
        metadata: {
          custom: { speaker: { botId: "alexander", name: "Alexander" } },
        },
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Take the city." }],
          timestamp: 2,
          stopReason: "stop",
        },
      },
    ]);
    expect(projected.map((row) => row.id)).toEqual(["a1", "a2"]);
    expect(projected[0]?.metadata?.custom?.speaker).toEqual({
      botId: "steve",
      name: "Steve Jobs",
    });
  });
});
