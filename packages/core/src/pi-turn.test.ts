import { describe, expect, it } from "vitest";
import { buildOwnedPiTurn, ownedPiTurnFromRun } from "./pi-turn.js";

const ROOM = [{ role: "user" as const, content: "Pitch the offer." }];

describe("buildOwnedPiTurn", () => {
  it("puts soul only in the system prompt so two bots do not share a cache prefix", () => {
    const steve = buildOwnedPiTurn({
      soul: "You are Steve Jobs.",
      messages: ROOM,
    });
    const hormozi = buildOwnedPiTurn({
      soul: "You are Alex Hormozi.",
      messages: ROOM,
    });
    expect(steve.systemPrompt).toBe("You are Steve Jobs.");
    expect(hormozi.systemPrompt).toBe("You are Alex Hormozi.");
    expect(steve.messages).toEqual(hormozi.messages);
    expect(steve.messages).toEqual([
      { role: "user", content: "Pitch the offer." },
    ]);
    expect(steve.systemPrompt).not.toContain("Pitch");
    expect(hormozi.messages.some((line) => line.content.includes("Steve"))).toBe(
      false,
    );
  });

  it("drops system rows from the log instead of merging them into the soul", () => {
    const turn = buildOwnedPiTurn({
      soul: "You are Piper.",
      messages: [
        { role: "system", content: "You are someone else." },
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
      ],
      prompt: "follow up",
    });
    expect(turn.systemPrompt).toBe("You are Piper.");
    expect(turn.messages).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
      { role: "user", content: "follow up" },
    ]);
  });

  it("does not duplicate the latest user prompt already in history", () => {
    expect(
      buildOwnedPiTurn({
        soul: "You are Piper.",
        messages: [{ role: "user", content: "summarize the handoff" }],
        prompt: "summarize the handoff",
      }).messages,
    ).toEqual([{ role: "user", content: "summarize the handoff" }]);
  });

  it("ends with a user line so the loop can continue", () => {
    expect(
      buildOwnedPiTurn({
        soul: "You are Piper.",
        messages: [{ role: "assistant", content: "Earlier." }],
      }).messages.at(-1)?.role,
    ).toBe("user");
  });
});

describe("ownedPiTurnFromRun", () => {
  it("uses instructions as soul and history plus prompt as the log", () => {
    expect(
      ownedPiTurnFromRun({
        botId: "bot-1",
        threadId: "thread-1",
        runId: "run-1",
        prompt: "follow up",
        instructions: "You are Piper.",
        history: [{ role: "user", content: "hello" }],
      }),
    ).toEqual({
      systemPrompt: "You are Piper.",
      messages: [
        { role: "user", content: "hello" },
        { role: "user", content: "follow up" },
      ],
    });
  });
});
