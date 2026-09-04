import { describe, expect, it } from "vitest";
import {
  assistantTurnHasVisibleWork,
  isWaitingForAssistantTurn,
} from "./thread-waiting";

const user = { role: "user", parts: [{ type: "text", text: "hi" }] };
const assistantText = {
  role: "assistant",
  parts: [{ type: "text", text: "hello" }],
};
const assistantEmpty = { role: "assistant", parts: [] };
const assistantReasoning = {
  role: "assistant",
  parts: [{ type: "reasoning", text: "hmm" }],
};
const assistantTool = {
  role: "assistant",
  parts: [{ type: "tool-call", text: "" }],
};

describe("assistantTurnHasVisibleWork", () => {
  it("ignores user, empty, and reasoning-only turns", () => {
    expect(assistantTurnHasVisibleWork(user)).toBe(false);
    expect(assistantTurnHasVisibleWork(assistantEmpty)).toBe(false);
    expect(assistantTurnHasVisibleWork(assistantReasoning)).toBe(false);
  });

  it("counts text and tools", () => {
    expect(assistantTurnHasVisibleWork(assistantText)).toBe(true);
    expect(assistantTurnHasVisibleWork(assistantTool)).toBe(true);
  });
});

describe("isWaitingForAssistantTurn", () => {
  it("is idle when nothing is in flight", () => {
    expect(
      isWaitingForAssistantTurn({
        isRunning: false,
        lastMessage: assistantText,
      }),
    ).toBe(false);
  });

  it("shows after send while the last row is still the user", () => {
    expect(
      isWaitingForAssistantTurn({
        isRunning: true,
        lastMessage: user,
      }),
    ).toBe(true);
  });

  it("stays up for an empty or reasoning-only assistant placeholder", () => {
    expect(
      isWaitingForAssistantTurn({
        isRunning: true,
        lastMessage: assistantEmpty,
      }),
    ).toBe(true);
    expect(
      isWaitingForAssistantTurn({
        isRunning: true,
        lastMessage: assistantReasoning,
      }),
    ).toBe(true);
  });

  it("hides once the assistant has visible work", () => {
    expect(
      isWaitingForAssistantTurn({
        isRunning: true,
        lastMessage: assistantText,
      }),
    ).toBe(false);
    expect(
      isWaitingForAssistantTurn({
        isRunning: true,
        lastMessage: assistantTool,
      }),
    ).toBe(false);
  });

  it("covers the gap after composer clear before chat status is submitted", () => {
    expect(
      isWaitingForAssistantTurn({
        isRunning: false,
        pending: true,
        lastMessage: assistantText,
      }),
    ).toBe(true);
    expect(
      isWaitingForAssistantTurn({
        isRunning: false,
        pending: true,
        lastMessage: user,
      }),
    ).toBe(true);
  });

  it("does not stick after the stream starts producing work", () => {
    expect(
      isWaitingForAssistantTurn({
        isRunning: true,
        pending: true,
        lastMessage: assistantText,
      }),
    ).toBe(false);
  });
});
