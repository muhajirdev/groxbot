import { afterEach, describe, expect, it } from "vitest";
import { draftCreatedBot } from "./hire";
import { orpc, queryClient } from "./orpc";
import {
  clearOfficeMessages,
  forgetOfficeMessages,
  peekOfficeMessages,
  setOfficeMessages,
  officeBotId,
  officeMessagesKey,
  officePreviewsFromCache,
} from "./office-messages";

const botId = "bot-cache-test";
const botsKey = orpc.bots.list.queryOptions().queryKey;

afterEach(() => {
  clearOfficeMessages();
  queryClient.removeQueries({ queryKey: botsKey });
});

describe("officeBotId", () => {
  it("is the Durable Object instance name", () => {
    expect(officeBotId("  bot-1  ")).toBe("bot-1");
  });

  it("rejects an empty id", () => {
    expect(() => officeBotId(" ")).toThrow(/office bot id/);
  });
});

describe("office messages cache", () => {
  it("round-trips messages in the query client", () => {
    expect(peekOfficeMessages(botId)).toBeUndefined();
    const messages = [
      { id: "m1", role: "user" as const, parts: [{ type: "text" as const, text: "hi" }] },
    ];
    setOfficeMessages(botId, messages);
    expect(peekOfficeMessages(botId)).toEqual(messages);
    expect(queryClient.getQueryData(officeMessagesKey(botId))).toEqual(messages);
  });

  it("treats an empty thread as cached", () => {
    setOfficeMessages(botId, []);
    expect(peekOfficeMessages(botId)).toEqual([]);
  });

  it("forgets one bot without clearing others", () => {
    setOfficeMessages(botId, [
      { id: "m1", role: "user" as const, parts: [{ type: "text" as const, text: "hi" }] },
    ]);
    setOfficeMessages("bot-keep", [
      { id: "m2", role: "user" as const, parts: [{ type: "text" as const, text: "stay" }] },
    ]);
    forgetOfficeMessages(botId);
    expect(peekOfficeMessages(botId)).toBeUndefined();
    expect(peekOfficeMessages("bot-keep")).toEqual([
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
    setOfficeMessages(botId, [
      { id: "m1", role: "user" as const, parts: [{ type: "text" as const, text: "Booked the room" }] },
    ]);
    expect(officePreviewsFromCache().get(botId)).toBe("Booked the room");
    expect(queryClient.getQueryData(botsKey)).toEqual([
      expect.objectContaining({ id: botId, lastPreview: "Booked the room" }),
    ]);
  });
});
