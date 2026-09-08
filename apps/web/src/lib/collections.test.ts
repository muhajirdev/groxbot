import { describe, expect, it, afterEach } from "vitest";
import {
  clearThreadStore,
  peekBots,
  removeBot,
  threadMetaCollection,
} from "./collections";
import { draftCreatedBot } from "./hire";
import { orpc, queryClient } from "./orpc";
import {
  clearAllPendingRosterDeletes,
  peekPendingBotDeletes,
} from "./roster-pending";

const botsKey = orpc.bots.list.queryOptions().queryKey;

afterEach(() => {
  clearAllPendingRosterDeletes();
  queryClient.removeQueries({ queryKey: botsKey });
});

describe("client collections", () => {
  it("starts empty in node tests", () => {
    expect(peekBots()).toEqual([]);
  });

  it("clears local thread meta without throwing", () => {
    threadMetaCollection.insert({
      botId: "bot-clear",
      cursor: 1,
      working: "",
      error: "",
      opening: false,
    });
    clearThreadStore();
    expect(threadMetaCollection.has("bot-clear")).toBe(false);
  });

  it("tombstones a bot even when the collection sync is not ready", () => {
    const ada = draftCreatedBot({
      id: "ada",
      workspaceId: "ws-1",
      name: "Ada",
      avatarColor: "#e45c9a",
    });
    queryClient.setQueryData(botsKey, [ada]);
    removeBot("ada");
    expect(peekPendingBotDeletes()).toContain("ada");
    expect(queryClient.getQueryData(botsKey)).toEqual([]);
  });
});
