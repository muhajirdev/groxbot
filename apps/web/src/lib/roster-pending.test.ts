import { afterEach, describe, expect, it } from "vitest";
import { draftCreatedBot } from "./hire";
import { overlayBotList } from "./bot-preview";
import { orpc, queryClient } from "./orpc";
import {
  clearAllPendingRosterDeletes,
  clearBotPendingDelete,
  isBotPendingDelete,
  markBotPendingDelete,
  peekPendingBotDeletes,
  withoutPendingBotDeletes,
} from "./roster-pending";
import { listedBots, botsListKey } from "./workspace-catalog";

const botsKey = orpc.bots.list.queryOptions().queryKey;

function bot(id: string) {
  return draftCreatedBot({
    id,
    workspaceId: "ws-1",
    name: id,
    avatarColor: "#e45c9a",
    homeRoomId: `home-${id}`,
  });
}

afterEach(() => {
  clearAllPendingRosterDeletes();
  queryClient.removeQueries({ queryKey: botsKey });
});

describe("roster pending deletes", () => {
  it("hides tombstoned bots from list overlays after a stale refetch", () => {
    const ada = bot("ada");
    const sam = bot("sam");
    markBotPendingDelete("ada");
    expect(overlayBotList([ada, sam]).map((row) => row.id)).toEqual(["sam"]);
    expect(withoutPendingBotDeletes([ada, sam]).map((row) => row.id)).toEqual([
      "sam",
    ]);
  });

  it("keeps the bot hidden when Query cache is rewritten with a pre-delete list", () => {
    const ada = bot("ada");
    const sam = bot("sam");
    markBotPendingDelete("ada");
    // Simulate a late bots.list apply that resurrected the row in Query.
    queryClient.setQueryData(botsListKey, [ada, sam]);
    expect(listedBots().map((row) => row.id)).toEqual(["sam"]);
    expect(isBotPendingDelete("ada")).toBe(true);
  });

  it("clears the tombstone when the delete is rolled back", () => {
    markBotPendingDelete("ada");
    clearBotPendingDelete("ada");
    expect(peekPendingBotDeletes()).toEqual([]);
    expect(overlayBotList([bot("ada")]).map((row) => row.id)).toEqual(["ada"]);
  });
});
