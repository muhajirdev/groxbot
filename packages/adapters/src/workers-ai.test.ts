import { HOSTED_AI_ENV, HOSTED_AI_FLAG } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { bindEdgeAgentRuntime } from "./edge-runtime.js";
import { CLOUDFLARE_DEEPSEEK_V4_FLASH } from "./gateway.js";
import {
  createHostedAgentRuntime,
  PiAgentRuntime,
} from "./runtime-core.js";
import { WorkersAiRuntime } from "./workers-ai.js";

const runRequest = {
  botId: "bot-1",
  threadId: "thread-1",
  runId: "run-1",
  prompt: "summarize the handoff",
  instructions: "You are Piper.",
  history: [{ role: "user" as const, content: "summarize the handoff" }],
  model:
    "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
};

const adapterContext = {
  operationId: "op-1",
  workspaceId: "ws-1",
  userId: "user-1",
  botId: "bot-1",
  runId: "run-1",
  signal: new AbortController().signal,
};

function sseStream(content: string, usage?: Record<string, number>) {
  const chunks = [
    `data: ${JSON.stringify({ response: content })}\n\n`,
    usage ? `data: ${JSON.stringify({ usage })}\n\n` : "",
    "data: [DONE]\n\n",
  ].join("");
  return new Response(chunks, {
    headers: { "content-type": "text/event-stream" },
  }).body;
}

describe("WorkersAiRuntime", () => {
  it("calls env.AI.run through the default gateway", async () => {
    const seen: Array<{
      model: string;
      gateway?: string;
      metadata?: Record<string, string>;
    }> = [];
    const runtime = new WorkersAiRuntime({
      gatewayId: "office",
      ai: {
        async run(model, _input, options) {
          seen.push({
            model,
            gateway: options?.gateway?.id,
            metadata: options?.gateway?.metadata,
          });
          return sseStream("DeepSeek says hello", {
            prompt_tokens: 4,
            completion_tokens: 3,
            total_tokens: 7,
          });
        },
      },
    });
    const events = [];
    for await (const event of runtime.run(runRequest, adapterContext)) {
      events.push(event);
    }
    expect(seen).toEqual([
      {
        model: CLOUDFLARE_DEEPSEEK_V4_FLASH,
        gateway: "office",
        metadata: {
          workspaceId: "ws-1",
          userId: "user-1",
          botId: "bot-1",
          runId: "run-1",
        },
      },
    ]);
    expect(events).toContainEqual({
      type: "text",
      text: "DeepSeek says hello",
    });
    expect(events).toContainEqual({
      type: "usage",
      promptTokens: 4,
      completionTokens: 3,
      totalTokens: 7,
    });
  });

  it("reads a non-streaming Workers AI object", async () => {
    const runtime = new WorkersAiRuntime({
      ai: {
        async run() {
          return {
            response: "JSON hello",
            usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
          };
        },
      },
    });
    const events = [];
    for await (const event of runtime.run(runRequest, adapterContext)) {
      events.push(event);
    }
    expect(events).toContainEqual({ type: "text", text: "JSON hello" });
    expect(events).toContainEqual({
      type: "usage",
      promptTokens: 2,
      completionTokens: 2,
      totalTokens: 4,
    });
  });
});

describe("createHostedAgentRuntime", () => {
  it("uses the Worker AI binding before REST tokens", () => {
    const runtime = createHostedAgentRuntime(
      {
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_AI_GATEWAY_TOKEN: "gw-token",
      },
      {
        ai: {
          async run() {
            return { response: "ok" };
          },
        },
      },
    );
    expect(runtime).toBeInstanceOf(WorkersAiRuntime);
  });

  it("fails closed without a binding or REST keys", () => {
    expect(() => createHostedAgentRuntime({})).toThrow(/AI binding/);
  });
});

describe("bindEdgeAgentRuntime", () => {
  it("uses Workers AI for hosted overlays", () => {
    const runtime = bindEdgeAgentRuntime(
      {
        env: { [HOSTED_AI_ENV]: HOSTED_AI_FLAG },
        model: CLOUDFLARE_DEEPSEEK_V4_FLASH,
        hosted: true,
      },
      {
        ai: {
          async run() {
            return { response: "ok" };
          },
        },
      },
    );
    expect(runtime).toBeInstanceOf(WorkersAiRuntime);
  });

  it("uses the REST gateway for BYOK overlays even if AI is bound", () => {
    const runtime = bindEdgeAgentRuntime(
      {
        env: {
          CLOUDFLARE_ACCOUNT_ID: "acct",
          CLOUDFLARE_AI_GATEWAY_TOKEN: "tok",
        },
        model: CLOUDFLARE_DEEPSEEK_V4_FLASH,
        hosted: false,
      },
      {
        ai: {
          async run() {
            return { response: "ok" };
          },
        },
      },
    );
    expect(runtime).toBeInstanceOf(PiAgentRuntime);
  });
});
