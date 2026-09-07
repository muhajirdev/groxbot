import { WORKSPACE_ID_HEADER } from "@groxbot/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { officeRpcUrl } from "./office-chat-rpc";
import { resetRpcWorkspace, setRpcWorkspaceId } from "./rpc-workspace";

afterEach(() => {
  resetRpcWorkspace();
});

describe("officeRpcUrl", () => {
  it("names the RoomActor Cap'n Web path after roomId", () => {
    expect(officeRpcUrl("bot_1")).toBe("ws://127.0.0.1:3100/rooms/bot_1/rpc");
  });

  it("stamps the live office so production sockets are not the session's last org", () => {
    setRpcWorkspaceId("ws-expandra");
    expect(officeRpcUrl("bot_1")).toBe(
      `ws://127.0.0.1:3100/rooms/bot_1/rpc?${WORKSPACE_ID_HEADER}=ws-expandra`,
    );
  });
});
