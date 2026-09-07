import { WORKSPACE_ID_HEADER } from "@groxbot/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { roomRpcUrl } from "./room-chat-rpc";
import { resetRpcWorkspace, setRpcWorkspaceId } from "./rpc-workspace";

afterEach(() => {
  resetRpcWorkspace();
});

describe("roomRpcUrl", () => {
  it("names the RoomActor Cap'n Web path after roomId", () => {
    expect(roomRpcUrl("room_1")).toBe("ws://127.0.0.1:3100/rooms/room_1/rpc");
  });

  it("stamps the live office so production sockets are not the session's last org", () => {
    setRpcWorkspaceId("ws-expandra");
    expect(roomRpcUrl("room_1")).toBe(
      `ws://127.0.0.1:3100/rooms/room_1/rpc?${WORKSPACE_ID_HEADER}=ws-expandra`,
    );
  });
});
