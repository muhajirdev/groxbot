import { describe, expect, it } from "vitest";
import {
  dropThinkKeepAlive,
  rememberThinkKeepAlive,
  touchThinkKeepAlive,
} from "./think-keepalive";

describe("touchThinkKeepAlive", () => {
  it("inserts the active bot at the front", () => {
    expect(touchThinkKeepAlive(["a", "b"], "c", 3)).toEqual(["c", "a", "b"]);
  });

  it("moves an existing bot to the front without duplicating", () => {
    expect(touchThinkKeepAlive(["a", "b", "c"], "b", 3)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("evicts the oldest when over the limit", () => {
    expect(touchThinkKeepAlive(["a", "b", "c"], "d", 3)).toEqual([
      "d",
      "a",
      "b",
    ]);
  });

  it("ignores blank ids", () => {
    expect(touchThinkKeepAlive(["a"], "  ", 3)).toEqual(["a"]);
  });
});

describe("rememberThinkKeepAlive", () => {
  it("does not reorder mounts when switching to a cached bot", () => {
    expect(
      rememberThinkKeepAlive(["a", "b", "c"], ["c", "b", "a"], "b", 3).mounted,
    ).toEqual(["a", "b", "c"]);
  });

  it("appends a first visit and evicts the LRU without shuffling the rest", () => {
    // LRU most-recent first: c, b, a → visiting d evicts a.
    expect(
      rememberThinkKeepAlive(["a", "b", "c"], ["c", "b", "a"], "d", 3),
    ).toEqual({
      mounted: ["b", "c", "d"],
      lru: ["d", "c", "b"],
    });
  });
});

describe("dropThinkKeepAlive", () => {
  it("removes a mounted bot", () => {
    expect(dropThinkKeepAlive(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });
});
