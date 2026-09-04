import { describe, expect, it } from "vitest";
import { officeRpcUrl } from "./office-chat-rpc";

describe("officeRpcUrl", () => {
  it("names the BotActor Cap'n Web path after botId", () => {
    expect(officeRpcUrl("bot_1")).toBe("ws://127.0.0.1:3100/bots/bot_1/rpc");
  });
});
