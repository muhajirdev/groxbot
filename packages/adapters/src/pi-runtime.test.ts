import {
  CLOUDFLARE_PROVIDER,
  DEFAULT_AI_GATEWAY_ID,
  HOSTED_STARTER_MODEL,
  OPENROUTER_PROVIDER,
} from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { cloudflareAiGatewayChatUrl, loadGatewayConfig } from "./gateway.js";
import { piAiRequestModel } from "./pi-ai-stream.js";
import { PiAgentRuntime } from "./pi-runtime.js";
import {
  createHostedAgentRuntime,
  GatewayAgentRuntime,
} from "./runtime-core.js";
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

function sseResponse(
  content = "Hello from DeepSeek",
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  },
) {
  const payload = [
    `data: ${JSON.stringify({
      id: "chunk-1",
      object: "chat.completion.chunk",
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content },
          finish_reason: null,
        },
      ],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: "chunk-1",
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      ...(usage ? { usage } : {}),
    })}\n\n`,
    "data: [DONE]\n\n",
  ].join("");
  return new Response(payload, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function chatUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input instanceof Request) return input.url;
  return String(input);
}

function chatHeaders(
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
): Headers {
  if (input instanceof Request) return new Headers(input.headers);
  return new Headers(init?.headers);
}

function chatBody(
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
): Record<string, unknown> {
  if (typeof init?.body === "string") {
    return JSON.parse(init.body) as Record<string, unknown>;
  }
  if (init?.body instanceof Uint8Array) {
    return JSON.parse(new TextDecoder().decode(init.body)) as Record<
      string,
      unknown
    >;
  }
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
}

function chatSignal(
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
): AbortSignal | undefined {
  return init?.signal ?? (input instanceof Request ? input.signal : undefined);
}

function systemText(messages: unknown): string | undefined {
  if (!Array.isArray(messages)) return undefined;
  const system = messages.find(
    (message) =>
      message &&
      typeof message === "object" &&
      (message as { role?: string }).role === "system",
  ) as { content?: unknown } | undefined;
  if (typeof system?.content === "string") return system.content;
  return undefined;
}

describe("PiAgentRuntime", () => {
  it("streams a Cloudflare chat completion through the owned Pi loop", async () => {
    const seen: Array<{
      url: string;
      model: string;
      auth?: string | null;
      metadata?: string | null;
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
            const headers = chatHeaders(input, init);
            const body = chatBody(input, init);
            seen.push({
              url: chatUrl(input),
              model: String(body.model ?? ""),
              auth:
                headers.get("cf-aig-authorization") ??
                headers.get("authorization"),
              metadata: headers.get("cf-aig-metadata"),
              includeUsage: (
                body.stream_options as { include_usage?: boolean } | undefined
              )?.include_usage,
              system: systemText(body.messages),
            });
            return sseResponse("DeepSeek says hello", {
              prompt_tokens: 4,
              completion_tokens: 3,
              total_tokens: 7,
            });
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
        url: cloudflareAiGatewayChatUrl("acct_123", DEFAULT_AI_GATEWAY_ID),
        model: piAiRequestModel(CLOUDFLARE_PROVIDER, HOSTED_STARTER_MODEL),
        auth: "Bearer cf-token",
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
    let releaseFetch: () => void = () => {};
    const fetchStarted = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    const runtime = new PiAgentRuntime(
      loadGatewayConfig(
        { OPENROUTER_API_KEY: "sk-or-test" },
        {
          fetch: async (input, init) =>
            new Promise((_, reject) => {
              const signal = chatSignal(input, init);
              const fail = () => {
                aborted = true;
                reject(new DOMException("Aborted", "AbortError"));
              };
              releaseFetch();
              if (signal?.aborted) {
                fail();
                return;
              }
              signal?.addEventListener("abort", fail);
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
    await fetchStarted;
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
