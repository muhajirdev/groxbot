import { describe, expect, it } from "vitest";
import {
  clearOfficeMessages,
  peekOfficeMessages,
  setOfficeMessages,
} from "./office-cache";

describe("clearOfficeMessages", () => {
  it("drops cached threads from the previous office", () => {
    setOfficeMessages("room-1", []);
    expect(peekOfficeMessages("room-1")).toEqual([]);
    clearOfficeMessages();
    expect(peekOfficeMessages("room-1")).toBeUndefined();
  });
});
