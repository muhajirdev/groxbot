import { describe, expect, it } from "vitest";
import { officeRpcUrl } from "./office-chat-rpc";

describe("officeRpcUrl", () => {
  it("names the RoomActor Cap'n Web path after roomId", () => {
    expect(officeRpcUrl("bot_1")).toBe("ws://127.0.0.1:3100/rooms/bot_1/rpc");
  });
});
