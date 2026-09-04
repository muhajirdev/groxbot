import { describe, expect, it } from "vitest";
import { roomRpcUrl } from "./room-chat-rpc";

describe("roomRpcUrl", () => {
  it("names the RoomActor Cap'n Web path after roomId", () => {
    expect(roomRpcUrl("room_1")).toBe("ws://127.0.0.1:3100/rooms/room_1/rpc");
  });
});
