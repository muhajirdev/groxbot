import {
  DEFAULT_AI_GATEWAY_ID,
  HOSTED_STARTER_MODEL,
  OPENROUTER_PROVIDER,
} from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  cloudflareChatUrl,
  gatewayRequestModel,
  loadGatewayConfig,
} from "./gateway.js";
import { PiAgentRuntime } from "./pi-runtime.js";
import { createHostedAgentRuntime, GatewayAgentRuntime } from "./runtime-core.js";
import { createAgentRuntime } from "./runtime.js";

const runRequest = {
  botId: "bot-1",
  threadId: "thread-1",
  runId: "run-1",
  prompt: "summarize the handoff",
  instructions: "You are Piper.",
  history: [{ role: "user" as const, content: "summarize the handoff" }],
};

const adapterContext = {
  operationId: "op-1",
  workspaceId: "ws-1",
  userId: "user-1",
  botId: "bot-1",
  runId: "run-1",
  signal: new AbortController().signal,
};

function sseResponse(chunks: string[], content = "Hello from DeepSeek") {
  const payload = chunks.length
    ? chunks.join("")
    : [
        `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
        "data: [DONE]\n\n",
      ].join("");
  return new Response(payload, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

describe("PiAgentRuntime", () => {
  it("streams a Cloudflare chat completion through the owned Pi loop", async () => {
    const seen: Array<{
      url: string;
      model: string;
      gateway?: string;
      metadata?: string;
      includeUsage?: boolean;
      system?: string;
    }> = [];
    const runtime = new PiAgentRuntime(
      loadGatewayConfig(
        {
          CLOUDFLARE_ACCOUNT_ID: "acct_123",
          CLOUDFLARE_API_TOKEN: "cf-token",
        },
        {
          fetch: async (input, init) => {
            const headers = new Headers(init?.headers);
            const body = JSON.parse(String(init?.body ?? "{}")) as {
              model: string;
              stream_options?: { include_usage?: boolean };
              messages: Array<{ role: string; content: string }>;
            };
            seen.push({
              url: String(input),
              model: body.model,
              gateway: headers.get("cf-aig-gateway-id") ?? undefined,
              metadata: headers.get("cf-aig-metadata") ?? undefined,
              includeUsage: body.stream_options?.include_usage,
              system: body.messages.find((message) => message.role === "system")
                ?.content,
            });
            return sseResponse(
              [
                `data: ${JSON.stringify({ choices: [{ delta: { content: "DeepSeek says hello" } }] })}\n\n`,
                `data: ${JSON.stringify({ usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 } })}\n\n`,
                "data: [DONE]\n\n",
              ],
              "unused",
            );
          },
        },
      ),
    );
    const events = [];
    for await (const event of runtime.run(runRequest, adapterContext)) {
      events.push(event);
    }
    expect(seen).toEqual([
      {
        url: cloudflareChatUrl("acct_123"),
        model: gatewayRequestModel(HOSTED_STARTER_MODEL),
        gateway: DEFAULT_AI_GATEWAY_ID,
        metadata: JSON.stringify({
          workspaceId: "ws-1",
          userId: "user-1",
          botId: "bot-1",
          runId: "run-1",
        }),
        includeUsage: true,
        system: "You are Piper.",
      },
    ]);
    expect(events).toContainEqual({
      type: "usage",
      promptTokens: 4,
      completionTokens: 3,
      totalTokens: 7,
    });
    expect(events.at(-1)).toEqual({
      type: "done",
      text: "DeepSeek says hello",
    });
  });

  it("aborts an in-flight Pi gateway request", async () => {
    let aborted = false;
    const runtime = new PiAgentRuntime(
      loadGatewayConfig(
        { OPENROUTER_API_KEY: "sk-or-test" },
        {
          fetch: async (_input, init) =>
            new Promise((_, reject) => {
              const fail = () => {
                aborted = true;
                reject(new DOMException("Aborted", "AbortError"));
              };
              if (init?.signal?.aborted) {
                fail();
                return;
              }
              init?.signal?.addEventListener("abort", fail);
            }),
        },
      ),
    );
    const events: Array<{ type: string }> = [];
    const running = (async () => {
      for await (const event of runtime.run(runRequest, adapterContext)) {
        events.push(event);
      }
    })();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await runtime.abort("run-1");
    await running;
    expect(aborted).toBe(true);
    expect(events.some((event) => event.type === "error")).toBe(false);
    expect(events.at(-1)).toEqual({ type: "done", text: "stopped" });
  });
});

describe("createHostedAgentRuntime", () => {
  it("uses Pi for the REST gateway arm", () => {
    expect(
      createHostedAgentRuntime({
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_AI_GATEWAY_TOKEN: "gw-token",
      }),
    ).toBeInstanceOf(PiAgentRuntime);
  });
});

describe("createAgentRuntime", () => {
  it("selects Pi as the owned-message hosted runtime", () => {
    expect(
      createAgentRuntime("pi", {
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_AI_GATEWAY_TOKEN: "gw-token",
      }),
    ).toBeInstanceOf(PiAgentRuntime);
    expect(() => createAgentRuntime("flue")).toThrow(/Unknown agent runtime/);
  });

  it("keeps an explicit OpenRouter provider on the gateway runtime", () => {
    expect(
      createAgentRuntime(OPENROUTER_PROVIDER, {
        OPENROUTER_API_KEY: "sk-or-test",
      }),
    ).toBeInstanceOf(GatewayAgentRuntime);
  });
});
