import { afterEach, describe, expect, it } from "vitest";
import {
  freshAppIds,
  readSeenAppIds,
  seenAppsKey,
  writeSeenAppIds,
} from "./live-apps-seen";

describe("live apps seen", () => {
  afterEach(() => {
    sessionStorage.removeItem(seenAppsKey("ws_1"));
  });

  it("treats unknown ids as fresh once a seen set exists", () => {
    expect(freshAppIds(["a", "b"], null)).toEqual([]);
    expect(freshAppIds(["a", "b"], new Set(["a"]))).toEqual(["b"]);
  });

  it("round-trips seen ids in sessionStorage", () => {
    expect(readSeenAppIds("ws_1")).toBeNull();
    writeSeenAppIds("ws_1", ["app_1", "app_2"]);
    expect(readSeenAppIds("ws_1")).toEqual(["app_1", "app_2"]);
  });
});
