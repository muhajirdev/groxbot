import { describe, expect, it } from "vitest";
import { applyChatToolOutput } from "./chat-tool-output.js";

describe("applyChatToolOutput", () => {
  it("patches the last assistant tool part like AI SDK Chat.addToolOutput", () => {
    const messages = [
      {
        id: "u1",
        role: "user" as const,
        parts: [{ type: "text", text: "list" }],
      },
      {
        id: "a1",
        role: "assistant" as const,
        parts: [
          {
            type: "tool-list",
            toolCallId: "tc-1",
            state: "input-available",
            input: { path: "/" },
          },
        ],
      },
    ];
    expect(
      applyChatToolOutput(messages, {
        toolCallId: "tc-1",
        output: { entries: [] },
      }),
    ).toEqual([
      messages[0],
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-list",
            toolCallId: "tc-1",
            state: "output-available",
            input: { path: "/" },
            output: { entries: [] },
          },
        ],
      },
    ]);
  });

  it("records output-error without touching other rows", () => {
    const messages = [
      {
        id: "a1",
        role: "assistant" as const,
        parts: [
          { type: "tool-exec", toolCallId: "tc-1", state: "input-available" },
          { type: "tool-list", toolCallId: "tc-2", state: "input-available" },
        ],
      },
    ];
    expect(
      applyChatToolOutput(messages, {
        toolCallId: "tc-1",
        state: "output-error",
        errorText: "nope",
      }).at(-1)?.parts,
    ).toEqual([
      {
        type: "tool-exec",
        toolCallId: "tc-1",
        state: "output-error",
        errorText: "nope",
      },
      { type: "tool-list", toolCallId: "tc-2", state: "input-available" },
    ]);
  });
});
