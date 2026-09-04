import { describe, expect, it } from "vitest";
import {
  agentMessagesUrl,
  agentSocketHost,
  agentWebSocketUrl,
  apiOrigin,
  officeAppUrl,
  officeRpcUrl,
  officeThreadUrl,
  webOrigin,
} from "./host";

describe("apiOrigin", () => {
  it("talks to wrangler in local dev", () => {
    expect(apiOrigin()).toBe("http://127.0.0.1:3100");
  });
});

describe("webOrigin", () => {
  it("talks to Vite in local dev", () => {
    expect(webOrigin()).toBe("http://127.0.0.1:5173");
  });
});

describe("agentSocketHost", () => {
  it("is the wrangler host", () => {
    expect(agentSocketHost()).toEqual({
      host: "127.0.0.1:3100",
      secure: false,
    });
  });

  it("uses TLS on the cloud API", () => {
    expect(agentSocketHost("https://api.groxbot.com")).toEqual({
      host: "api.groxbot.com",
      secure: true,
    });
  });
});

describe("Agent URLs", () => {
  it("names the BotActor instance after botId", () => {
    expect(agentMessagesUrl("bot_1")).toBe(
      "http://127.0.0.1:3100/agents/bot-actor/bot_1/get-messages",
    );
    expect(agentWebSocketUrl("bot_1")).toBe(
      "ws://127.0.0.1:3100/agents/bot-actor/bot_1",
    );
    expect(officeRpcUrl("bot_1")).toBe("ws://127.0.0.1:3100/bots/bot_1/rpc");
  });
});

describe("office URLs", () => {
  it("opens live apps on the web office", () => {
    expect(officeThreadUrl("bot_1")).toBe("http://127.0.0.1:5173/bot_1");
    expect(officeAppUrl("bot_1", "app_9")).toBe(
      "http://127.0.0.1:5173/bot_1?pane=app&app=app_9",
    );
  });
});
