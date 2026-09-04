import { describe, expect, it } from "vitest";
import { jsonClone } from "./office-chat.js";
import {
  applyPiOfficeEvent,
  emptyPiOfficeView,
  officeChatToPiBound,
  parsePiAgentMessage,
  parsePiBoundMessage,
  parsePiClientEvent,
  parsePiLogMessages,
  lastPiAssistantText,
  piAssistantText,
  piLoopMessages,
  piLogShouldRun,
  piViewMessages,
  takePiAssistantDraft,
} from "./pi-transcript.js";

describe("parse Pi wire", () => {
  it("round-trips user, assistant, and toolResult", () => {
    const user = parsePiAgentMessage({
      role: "user",
      content: "hi",
      timestamp: 1,
    });
    const assistant = parsePiAgentMessage({
      role: "assistant",
      content: [
        { type: "text", text: "ok" },
        { type: "toolCall", id: "c1", name: "list", arguments: { path: "/" } },
      ],
      timestamp: 2,
      stopReason: "toolUse",
    });
    const tool = parsePiAgentMessage({
      role: "toolResult",
      toolCallId: "c1",
      toolName: "list",
      content: [{ type: "text", text: "[]" }],
      isError: false,
      timestamp: 3,
    });
    expect(user?.role).toBe("user");
    expect(assistant?.role).toBe("assistant");
    expect(assistant && piAssistantText(assistant)).toBe("ok");
    expect(tool?.role).toBe("toolResult");
    if (user && assistant && tool) {
      expect(
        lastPiAssistantText([
          { id: "u1", message: user },
          { id: "a1", message: assistant },
          { id: "t1", message: tool },
        ]),
      ).toBe("ok");
    }
    expect(
      parsePiBoundMessage({
        id: "u1",
        message: user,
      }),
    ).toEqual({ id: "u1", message: user });
  });

  it("rejects a generator-like object from jsonClone", () => {
    const gen = (async function* () {
      yield 1;
    })();
    expect(jsonClone(gen)).toBeNull();
    expect(jsonClone({ details: gen })).toEqual({});
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    expect(jsonClone(cycle)).toBeNull();
  });

  it("parses a snapshot event", () => {
    const event = parsePiClientEvent({
      threadId: "room-1",
      seq: 1,
      type: "snapshot",
      snapshot: {
        metadata: { id: "room-1", status: "idle" },
        messages: [
          {
            id: "u1",
            message: { role: "user", content: "hi", timestamp: 1 },
          },
        ],
      },
    });
    expect(event?.type).toBe("snapshot");
    expect(parsePiClientEvent({ type: "snapshot" })).toBeNull();
  });
});

describe("applyPiOfficeEvent", () => {
  it("replaces on snapshot and streams then commits", () => {
    let view = emptyPiOfficeView("room-1");
    view = applyPiOfficeEvent(view, {
      threadId: "room-1",
      seq: 1,
      type: "snapshot",
      snapshot: {
        metadata: { id: "room-1", status: "idle" },
        messages: [
          {
            id: "u1",
            message: { role: "user", content: "hi", timestamp: 1 },
          },
        ],
      },
    });
    expect(view.messages).toHaveLength(1);
    view = applyPiOfficeEvent(view, {
      threadId: "room-1",
      seq: 2,
      type: "message_update",
      id: "a1",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "hel" }],
        timestamp: 2,
      },
    });
    expect(view.streaming?.id).toBe("a1");
    view = applyPiOfficeEvent(view, {
      threadId: "room-1",
      seq: 3,
      type: "message_end",
      id: "a1",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "hello" }],
        timestamp: 2,
        stopReason: "stop",
      },
    });
    expect(view.streaming).toBeNull();
    expect(view.messages.at(-1)?.message).toMatchObject({
      role: "assistant",
      content: [{ type: "text", text: "hello" }],
    });
  });

  it("pairs live tool execution onto the view", () => {
    let view = emptyPiOfficeView("room-1");
    view = applyPiOfficeEvent(view, {
      threadId: "room-1",
      seq: 1,
      type: "tool_execution_start",
      toolCallId: "c1",
      toolName: "list",
      args: { path: "/" },
    });
    view = applyPiOfficeEvent(view, {
      threadId: "room-1",
      seq: 2,
      type: "tool_execution_end",
      toolCallId: "c1",
      result: { entries: [] },
      isError: false,
    });
    expect(view.toolExecutions.c1).toMatchObject({
      status: "done",
      result: { entries: [] },
    });
  });

  it("drops a streaming overlay after message_end even when ids differ", () => {
    let view = emptyPiOfficeView("room-1");
    view = applyPiOfficeEvent(view, {
      threadId: "room-1",
      seq: 1,
      type: "message_update",
      message: {
        role: "assistant",
        content: [
          { type: "toolCall", id: "c1", name: "list", arguments: { path: "/" } },
        ],
        timestamp: 1,
      },
    });
    expect(view.streaming?.id).toBe("stream");
    view = applyPiOfficeEvent(view, {
      threadId: "room-1",
      seq: 2,
      type: "message_end",
      id: "a2",
      message: {
        role: "assistant",
        content: [
          { type: "toolCall", id: "c1", name: "list", arguments: { path: "/" } },
        ],
        timestamp: 1,
        stopReason: "toolUse",
      },
    });
    expect(view.streaming).toBeNull();
    const visible = piViewMessages(view);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe("a2");
  });

  it("tracks who holds the room floor", () => {
    let view = emptyPiOfficeView("room-1");
    view = applyPiOfficeEvent(view, {
      threadId: "room-1",
      seq: 1,
      type: "floor",
      botId: "hormozi",
    });
    expect(view.floorBotId).toBe("hormozi");
    view = applyPiOfficeEvent(view, {
      threadId: "room-1",
      seq: 2,
      type: "floor",
      botId: "",
    });
    expect(view.floorBotId).toBe("");
  });
});

describe("takePiAssistantDraft", () => {
  it("reuses one id for a bubble then mints another after message_end", () => {
    const draft: { id?: string } = {};
    const start = takePiAssistantDraft(draft, {
      type: "message_start",
      message: { role: "assistant" },
    });
    const update = takePiAssistantDraft(draft, {
      type: "message_update",
      message: { role: "assistant" },
    });
    const end = takePiAssistantDraft(draft, {
      type: "message_end",
      message: { role: "assistant" },
    });
    expect(start).toBeTruthy();
    expect(update).toBe(start);
    expect(end).toBe(start);
    const next = takePiAssistantDraft(draft, {
      type: "message_start",
      message: { role: "assistant" },
    });
    expect(next).toBeTruthy();
    expect(next).not.toBe(start);
    expect(
      takePiAssistantDraft(draft, {
        type: "message_end",
        message: { role: "toolResult" },
      }),
    ).toBeUndefined();
  });
});

describe("officeChatToPiBound", () => {
  it("expands tool parts into assistant + toolResult", () => {
    const bound = officeChatToPiBound([
      { id: "u1", role: "user", parts: [{ type: "text", text: "list" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-list",
            toolCallId: "c1",
            state: "output-available",
            input: { path: "/" },
            output: { entries: [] },
          },
        ],
      },
    ]);
    expect(piLoopMessages(bound).map((row) => row.role)).toEqual([
      "user",
      "assistant",
      "toolResult",
    ]);
    expect(piLogShouldRun(bound)).toBe(false);
    expect(parsePiLogMessages(bound)).toHaveLength(3);
  });
});
