import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AgentEvent } from "@earendil-works/pi-agent-core";
import { describe, expect, it } from "vitest";
import {
  applyOfficeAgentEvent,
  emptyOfficeDraft,
  officeDraftMessage,
  officeLogToPiMessages,
} from "./office-pi.js";
import { piCompletionsModel } from "./pi-turn.js";

const model = piCompletionsModel("test-model");

describe("officeLogToPiMessages", () => {
  it("keeps user text and assistant tool results for a follow-up turn", () => {
    const messages = officeLogToPiMessages(
      [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "Show the offer." }],
        },
        {
          id: "a1",
          role: "assistant",
          parts: [
            { type: "text", text: "Presenting." },
            {
              type: "tool-present",
              toolCallId: "call_1",
              state: "output-available",
              input: { $type: "Card" },
              output: { ok: true },
            },
          ],
        },
      ],
      model,
    );
    expect(messages.map((row) => row.role)).toEqual([
      "user",
      "assistant",
      "toolResult",
    ]);
    const assistant = messages[1];
    expect(assistant?.role).toBe("assistant");
    if (assistant?.role !== "assistant") return;
    expect(assistant.content).toEqual([
      { type: "text", text: "Presenting." },
      {
        type: "toolCall",
        id: "call_1",
        name: "present",
        arguments: { $type: "Card" },
      },
    ]);
    expect(messages[2]).toMatchObject({
      role: "toolResult",
      toolCallId: "call_1",
      toolName: "present",
      isError: false,
    });
  });
});

describe("applyOfficeAgentEvent", () => {
  it("projects text deltas and present tool output onto a UIMessage", () => {
    let draft = emptyOfficeDraft("a1");
    draft = applyOfficeAgentEvent(draft, {
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        contentIndex: 0,
        delta: "Hi",
        partial: { role: "assistant", content: [{ type: "text", text: "Hi" }] },
      },
    } as unknown as AgentEvent);
    draft = applyOfficeAgentEvent(draft, {
      type: "tool_execution_start",
      toolCallId: "call_1",
      toolName: "present",
      args: { $type: "Fact" },
    });
    draft = applyOfficeAgentEvent(draft, {
      type: "tool_execution_end",
      toolCallId: "call_1",
      toolName: "present",
      result: { ok: true },
      isError: false,
    });
    expect(officeDraftMessage(draft)).toEqual({
      id: "a1",
      role: "assistant",
      parts: [
        { type: "text", text: "Hi" },
        {
          type: "tool-present",
          toolCallId: "call_1",
          toolName: "present",
          state: "output-available",
          input: { $type: "Fact" },
          output: { ok: true },
        },
      ],
    });
  });

  it("does not reopen a finished tool on turn_end", () => {
    let draft = emptyOfficeDraft("a1");
    draft = applyOfficeAgentEvent(draft, {
      type: "tool_execution_start",
      toolCallId: "call_1",
      toolName: "list",
      args: { path: "/workspace" },
    });
    draft = applyOfficeAgentEvent(draft, {
      type: "tool_execution_end",
      toolCallId: "call_1",
      toolName: "list",
      result: { entries: [] },
      isError: false,
    });
    draft = applyOfficeAgentEvent(draft, {
      type: "turn_end",
      message: {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "call_1",
            name: "list",
            arguments: { path: "/workspace" },
          },
        ],
      },
    } as unknown as AgentEvent);
    expect(officeDraftMessage(draft).parts).toEqual([
      {
        type: "tool-list",
        toolCallId: "call_1",
        toolName: "list",
        state: "output-available",
        input: { path: "/workspace" },
        output: { entries: [] },
      },
    ]);
  });
});

describe("Worker barrel", () => {
  it("re-exports openObjectParameters from @groxbot/adapters/edge", () => {
    const edge = readFileSync(
      fileURLToPath(new URL("./edge.ts", import.meta.url)),
      "utf8",
    );
    expect(edge).toMatch(/openObjectParameters/);
  });
});
