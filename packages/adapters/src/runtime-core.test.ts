import { describe, expect, it } from "vitest";
import {
  createHostedAgentRuntime,
  GatewayAgentRuntime,
  ScriptedAgentRuntime,
} from "./runtime-core.js";

const runRequest = {
  botId: "bot-1",
  threadId: "thread-1",
  runId: "run-1",
  prompt: "hello",
  history: [] as Array<{ role: "user"; content: string }>,
};

const adapterContext = {
  operationId: "op-1",
  workspaceId: "ws-1",
  userId: "user-1",
  botId: "bot-1",
  runId: "run-1",
  signal: new AbortController().signal,
};

describe("createHostedAgentRuntime", () => {
  it("uses REST gateway keys when the AI binding is absent", () => {
    expect(
      createHostedAgentRuntime({
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_AI_GATEWAY_TOKEN: "gw-token",
      }),
    ).toBeInstanceOf(GatewayAgentRuntime);
  });

  it("fails closed without an AI binding or gateway keys", () => {
    expect(() => createHostedAgentRuntime({})).toThrow(/AI binding/);
  });
});

describe("ScriptedAgentRuntime", () => {
  it("echoes for offline tests", async () => {
    const runtime = new ScriptedAgentRuntime();
    const events = [];
    for await (const event of runtime.run(runRequest, adapterContext)) {
      events.push(event);
    }
    expect(events).toContainEqual({ type: "text", text: "Echo: hello" });
  });
});
