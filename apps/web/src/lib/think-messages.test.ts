import { afterEach, describe, expect, it } from "vitest";
import { draftCreatedBot } from "./hire";
import { orpc, queryClient } from "./orpc";
import {
  clearThinkMessages,
  forgetThinkMessages,
  peekThinkMessages,
  setThinkMessages,
  thinkAgentId,
  thinkMessagesKey,
  thinkPreviewsFromCache,
} from "./think-messages";

const botId = "bot-cache-test";
const botsKey = orpc.bots.list.queryOptions().queryKey;

afterEach(() => {
  clearThinkMessages();
  queryClient.removeQueries({ queryKey: botsKey });
});

describe("thinkAgentId", () => {
  it("is the Durable Object instance name", () => {
    expect(thinkAgentId("  bot-1  ")).toBe("bot-1");
  });

  it("rejects an empty id", () => {
    expect(() => thinkAgentId(" ")).toThrow(/think agent id/);
  });
});

describe("think messages cache", () => {
  it("round-trips messages in the query client", () => {
    expect(peekThinkMessages(botId)).toBeUndefined();
    const messages = [
      { id: "m1", role: "user" as const, parts: [{ type: "text" as const, text: "hi" }] },
    ];
    setThinkMessages(botId, messages);
    expect(peekThinkMessages(botId)).toEqual(messages);
    expect(queryClient.getQueryData(thinkMessagesKey(botId))).toEqual(messages);
  });

  it("treats an empty thread as cached", () => {
    setThinkMessages(botId, []);
    expect(peekThinkMessages(botId)).toEqual([]);
  });

  it("forgets one bot without clearing others", () => {
    setThinkMessages(botId, [
      { id: "m1", role: "user" as const, parts: [{ type: "text" as const, text: "hi" }] },
    ]);
    setThinkMessages("bot-keep", [
      { id: "m2", role: "user" as const, parts: [{ type: "text" as const, text: "stay" }] },
    ]);
    forgetThinkMessages(botId);
    expect(peekThinkMessages(botId)).toBeUndefined();
    expect(peekThinkMessages("bot-keep")).toEqual([
      { id: "m2", role: "user" as const, parts: [{ type: "text" as const, text: "stay" }] },
    ]);
  });

  it("writes the last line onto the persisted roster", () => {
    queryClient.setQueryData(botsKey, [
      draftCreatedBot({
        id: botId,
        workspaceId: "ws-1",
        name: "Piper",
        avatarColor: "#e45c9a",
      }),
    ]);
    setThinkMessages(botId, [
      { id: "m1", role: "user" as const, parts: [{ type: "text" as const, text: "Booked the room" }] },
    ]);
    expect(thinkPreviewsFromCache().get(botId)).toBe("Booked the room");
    expect(queryClient.getQueryData(botsKey)).toEqual([
      expect.objectContaining({ id: botId, lastPreview: "Booked the room" }),
    ]);
  });
});
