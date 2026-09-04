import { describe, expect, it } from "vitest";
import {
  dropLastAssistant,
  lastOfficeUserMessage,
  nextOfficeGeneration,
  officeChatShouldRun,
  officeChatText,
  parseOfficeChatMessages,
  settleOfficeToolParts,
  stringifyToolOutput,
  toolNameFromPart,
  upsertOfficeChatMessage,
} from "./office-chat.js";

describe("parseOfficeChatMessages", () => {
  it("keeps user and assistant rows with parts", () => {
    expect(
      parseOfficeChatMessages([
        { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
        { id: "a1", role: "assistant", parts: [{ type: "text", text: "yo" }] },
        { id: "", role: "user", parts: [] },
        { role: "user", parts: [] },
      ]),
    ).toEqual([
      { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "yo" }] },
    ]);
  });
});

describe("officeChatText", () => {
  it("reads UIMessage parts and model content", () => {
    expect(
      officeChatText({
        parts: [{ type: "text", text: "hello" }, { type: "step-start" }],
      }),
    ).toBe("hello");
    expect(
      officeChatText({
        content: [{ type: "text", text: "/agreements" }],
      }),
    ).toBe("/agreements");
  });
});

describe("officeChatShouldRun", () => {
  it("runs only when the log ends on a user row", () => {
    const user = {
      id: "u1",
      role: "user" as const,
      parts: [{ type: "text", text: "go" }],
    };
    const assistant = {
      id: "a1",
      role: "assistant" as const,
      parts: [{ type: "text", text: "ok" }],
    };
    expect(officeChatShouldRun([user])).toBe(true);
    expect(officeChatShouldRun([user, assistant])).toBe(false);
    expect(officeChatShouldRun([])).toBe(false);
    expect(lastOfficeUserMessage([assistant, user])?.id).toBe("u1");
  });
});

describe("upsert and regenerate", () => {
  it("replaces a row by id and drops a trailing assistant", () => {
    const user = {
      id: "u1",
      role: "user" as const,
      parts: [{ type: "text", text: "go" }],
    };
    const assistant = {
      id: "a1",
      role: "assistant" as const,
      parts: [{ type: "text", text: "ok" }],
    };
    expect(
      upsertOfficeChatMessage([user], {
        ...assistant,
        parts: [{ type: "text", text: "stream" }],
      }),
    ).toEqual([
      user,
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "stream" }],
      },
    ]);
    expect(
      upsertOfficeChatMessage([user, assistant], {
        ...assistant,
        parts: [{ type: "text", text: "done" }],
      }),
    ).toEqual([
      user,
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "done" }] },
    ]);
    expect(dropLastAssistant([user, assistant])).toEqual([user]);
    expect(dropLastAssistant([user])).toEqual([user]);
  });
});

describe("nextOfficeGeneration", () => {
  it("bumps a stored generation", () => {
    expect(nextOfficeGeneration(undefined)).toBe(1);
    expect(nextOfficeGeneration(3)).toBe(4);
    expect(nextOfficeGeneration(0)).toBe(1);
  });
});

describe("tool parts", () => {
  it("reads present and dynamic tool names", () => {
    expect(toolNameFromPart({ type: "tool-present", input: {} })).toBe(
      "present",
    );
    expect(
      toolNameFromPart({ type: "dynamic-tool", toolName: "execute" }),
    ).toBe("execute");
    expect(toolNameFromPart({ type: "text", text: "hi" })).toBeNull();
    expect(stringifyToolOutput({ ok: true })).toBe('{"ok":true}');
  });

  it("settles unfinished tools and keeps completed ones", () => {
    expect(
      settleOfficeToolParts(
        [
          { type: "text", text: "Hi" },
          {
            type: "tool-list",
            toolCallId: "a",
            state: "output-available",
            output: { entries: [] },
          },
          {
            type: "tool-exec",
            toolCallId: "b",
            state: "input-available",
            input: { command: "ls" },
          },
          {
            type: "tool-write",
            toolCallId: "c",
            state: "input-available",
            approval: { id: "appr-1" },
          },
        ],
        "Cancelled.",
      ),
    ).toEqual([
      { type: "text", text: "Hi" },
      {
        type: "tool-list",
        toolCallId: "a",
        state: "output-available",
        output: { entries: [] },
      },
      {
        type: "tool-exec",
        toolCallId: "b",
        state: "output-error",
        input: { command: "ls" },
        errorText: "Cancelled.",
      },
      {
        type: "tool-write",
        toolCallId: "c",
        state: "input-available",
        approval: { id: "appr-1" },
      },
    ]);
  });
});
