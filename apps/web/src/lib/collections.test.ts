import { describe, expect, it } from "vitest";
import {
  clearThreadStore,
  peekBots,
  threadMetaCollection,
} from "./collections";

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
});
