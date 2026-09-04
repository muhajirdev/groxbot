import {
  CLOUDFLARE_PROVIDER,
  DEFAULT_AI_GATEWAY_ID,
  HOSTED_AI_ENV,
  HOSTED_AI_FLAG,
  HOSTED_STARTER_MODEL,
  OPENROUTER_PROVIDER,
  PRODUCT_RUNTIME,
} from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  CLOUDFLARE_DEEPSEEK_V4_FLASH,
  chatMessages,
  cloudflareAiGatewayChatUrl,
  completionUsage,
  deltaText,
  deltaToolCalls,
  finishReason,
  gatewayChatUrl,
  gatewayConfigured,
  gatewayErrorMessage,
  gatewayHeaders,
  gatewayRequestModel,
  loadGatewayConfig,
  OPENROUTER_DEEPSEEK_V4_FLASH,
} from "./gateway.js";
import { piAiRequestModel } from "./pi-ai-stream.js";
import {
  agentRuntimeNeedsModel,
  createAgentRuntime,
  GatewayAgentRuntime,
  parsePokePrompt,
  resolveAgentRuntimeKind,
  ScriptedAgentRuntime,
} from "./runtime.js";

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

function sseResponse(content = "Hello from DeepSeek", usage?: {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}) {
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
  if (init?.body == null && input instanceof Request) {
    throw new Error("OpenAI SDK sent a Request without init.body");
  }
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
}

function chatSignal(
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
): AbortSignal | undefined {
  return init?.signal ?? (input instanceof Request ? input.signal : undefined);
}

describe("loadGatewayConfig", () => {
  it("defaults Cloudflare to GLM 5.3 Flash on Workers AI", () => {
    const config = loadGatewayConfig({
      CLOUDFLARE_ACCOUNT_ID: "acct_123",
      CLOUDFLARE_API_TOKEN: "cf-token",
    });
    expect(config.provider).toBe(CLOUDFLARE_PROVIDER);
    expect(config.model).toBe(gatewayRequestModel(HOSTED_STARTER_MODEL));
    expect(config.gatewayId).toBe(DEFAULT_AI_GATEWAY_ID);
    expect(gatewayChatUrl(config)).toBe(
      cloudflareAiGatewayChatUrl("acct_123", DEFAULT_AI_GATEWAY_ID),
    );
    expect(gatewayHeaders(config)["cf-aig-gateway-id"]).toBe(
      DEFAULT_AI_GATEWAY_ID,
    );
    expect(gatewayHeaders(config).authorization).toBe("Bearer cf-token");
  });

  it("defaults OpenRouter to the same DeepSeek v4 Flash release", () => {
    const config = loadGatewayConfig({
      OPENROUTER_API_KEY: "sk-or-test",
    });
    expect(config.provider).toBe(OPENROUTER_PROVIDER);
    expect(config.model).toBe(OPENROUTER_DEEPSEEK_V4_FLASH);
    expect(gatewayChatUrl(config)).toBe(
      "https://openrouter.ai/api/v1/chat/completions",
    );
    expect(gatewayHeaders(config)["X-Title"]).toBe("Groxbot");
  });

  it("prefers Cloudflare when both providers are configured", () => {
    const config = loadGatewayConfig({
      CLOUDFLARE_ACCOUNT_ID: "acct_123",
      CLOUDFLARE_API_TOKEN: "cf-token",
      OPENROUTER_API_KEY: "sk-or-test",
    });
    expect(config.provider).toBe(CLOUDFLARE_PROVIDER);
  });

  it("honors an explicit OpenRouter provider", () => {
    const config = loadGatewayConfig({
      AI_GATEWAY_PROVIDER: OPENROUTER_PROVIDER,
      OPENROUTER_API_KEY: "sk-or-test",
      CLOUDFLARE_ACCOUNT_ID: "acct_123",
      CLOUDFLARE_API_TOKEN: "cf-token",
    });
    expect(config.provider).toBe(OPENROUTER_PROVIDER);
  });

  it("accepts CLOUDFLARE_AI_GATEWAY_TOKEN and defaults the gateway id", () => {
    const config = loadGatewayConfig({
      CLOUDFLARE_ACCOUNT_ID: "acct_123",
      CLOUDFLARE_AI_GATEWAY_TOKEN: "gw-token",
      CLOUDFLARE_AI_GATEWAY_ID: "office",
    });
    expect(config.provider).toBe(CLOUDFLARE_PROVIDER);
    expect(config.apiKey).toBe("gw-token");
    expect(config.gatewayId).toBe("office");
    expect(gatewayHeaders(config).authorization).toBe("Bearer gw-token");
  });

  it("throws when no gateway keys are set", () => {
    expect(() => loadGatewayConfig({})).toThrow(/not configured/);
    expect(gatewayConfigured({})).toBe(false);
    expect(
      gatewayConfigured({
        CLOUDFLARE_ACCOUNT_ID: "acct_123",
      }),
    ).toBe(false);
  });
});

describe("chatMessages", () => {
  it("does not duplicate the latest user prompt already in history", () => {
    expect(chatMessages(runRequest)).toEqual([
      { role: "system", content: "You are Piper." },
      { role: "user", content: "summarize the handoff" },
    ]);
  });
});

describe("deltaText", () => {
  it("reads OpenAI-compatible streaming and Cloudflare envelopes", () => {
    expect(deltaText({ choices: [{ delta: { content: "Hi" } }] })).toBe("Hi");
    expect(
      deltaText({
        result: { choices: [{ message: { content: "Done" } }] },
      }),
    ).toBe("Done");
  });
});

describe("deltaToolCalls", () => {
  it("reads streamed function-call chunks", () => {
    expect(
      deltaToolCalls({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  function: { name: "present", arguments: '{"$type"' },
                },
              ],
            },
          },
        ],
      }),
    ).toEqual([
      {
        index: 0,
        id: "call_1",
        name: "present",
        arguments: '{"$type"',
      },
    ]);
    expect(finishReason({ choices: [{ finish_reason: "tool_calls" }] })).toBe(
      "tool_calls",
    );
  });
});

describe("completionUsage", () => {
  it("reads OpenAI-compatible usage and Cloudflare envelopes", () => {
    expect(
      completionUsage({
        usage: {
          prompt_tokens: 11,
          completion_tokens: 7,
          total_tokens: 18,
        },
      }),
    ).toEqual({ promptTokens: 11, completionTokens: 7, totalTokens: 18 });
    expect(
      completionUsage({
        result: { usage: { prompt_tokens: "3", completion_tokens: 2 } },
      }),
    ).toEqual({ promptTokens: 3, completionTokens: 2, totalTokens: 5 });
    expect(completionUsage({ choices: [{ delta: { content: "Hi" } }] })).toBe(
      null,
    );
  });
});

describe("gatewayErrorMessage", () => {
  it("pulls Cloudflare and OpenRouter error text", () => {
    expect(
      gatewayErrorMessage(
        401,
        JSON.stringify({ errors: [{ message: "invalid token" }] }),
      ),
    ).toBe("invalid token");
    expect(
      gatewayErrorMessage(
        402,
        JSON.stringify({ error: { message: "out of credits" } }),
      ),
    ).toBe("out of credits");
  });
});

describe("GatewayAgentRuntime", () => {
  it("streams a Cloudflare chat completion", async () => {
    const seen: Array<{
      url: string;
      model: string;
      auth?: string | null;
      metadata?: string | null;
      includeUsage?: boolean;
    }> = [];
    const runtime = new GatewayAgentRuntime(
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
      },
    ]);
    expect(events).toContainEqual({
      type: "usage",
      promptTokens: 4,
      completionTokens: 3,
      totalTokens: 7,
    });
    expect(events.at(-2)).toEqual({
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

  it("sends the Workers AI @cf id for catalog models", async () => {
    let model = "";
    const runtime = new GatewayAgentRuntime(
      loadGatewayConfig(
        {
          CLOUDFLARE_ACCOUNT_ID: "acct_123",
          CLOUDFLARE_API_TOKEN: "cf-token",
        },
        {
          fetch: async (input, init) => {
            model = String(chatBody(input, init).model ?? "");
            return sseResponse("ok");
          },
        },
      ),
    );
    for await (const _event of runtime.run(
      {
        ...runRequest,
        model:
          "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
      },
      adapterContext,
    )) {
      // drain
    }
    expect(model).toBe(`workers-ai/${CLOUDFLARE_DEEPSEEK_V4_FLASH}`);
    expect(
      gatewayRequestModel(
        "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
      ),
    ).toBe(CLOUDFLARE_DEEPSEEK_V4_FLASH);
  });

  it("posts to OpenRouter with the DeepSeek v4 Flash model id", async () => {
    let url = "";
    let model = "";
    const runtime = createAgentRuntime(
      OPENROUTER_PROVIDER,
      { OPENROUTER_API_KEY: "sk-or-test" },
      async (input, init) => {
        url = chatUrl(input);
        model = String(chatBody(input, init).model ?? "");
        return sseResponse("OpenRouter hello");
      },
    );
    const texts: string[] = [];
    for await (const event of runtime.run(runRequest, adapterContext)) {
      if (event.type === "text") texts.push(event.text);
    }
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(model).toBe(OPENROUTER_DEEPSEEK_V4_FLASH);
    expect(texts).toEqual(["OpenRouter hello"]);
  });

  it("reads a streamed OpenAI-compatible completion", async () => {
    const runtime = new GatewayAgentRuntime(
      loadGatewayConfig(
        { OPENROUTER_API_KEY: "sk-or-test" },
        {
          fetch: async () => sseResponse("JSON hello"),
        },
      ),
    );
    const events = [];
    for await (const event of runtime.run(runRequest, adapterContext)) {
      events.push(event);
    }
    expect(events).toContainEqual({ type: "text", text: "JSON hello" });
  });

  it("surfaces gateway HTTP errors", async () => {
    const runtime = new GatewayAgentRuntime(
      loadGatewayConfig(
        { OPENROUTER_API_KEY: "sk-or-test" },
        {
          fetch: async () =>
            new Response(JSON.stringify({ error: { message: "nope" } }), {
              status: 401,
              headers: { "content-type": "application/json" },
            }),
        },
      ),
    );
    const events = [];
    for await (const event of runtime.run(runRequest, adapterContext)) {
      events.push(event);
    }
    expect(events.some((event) => event.type === "error")).toBe(true);
    const error = events.find((event) => event.type === "error");
    expect(error && "text" in error ? error.text : "").toMatch(/nope/i);
  });

  it("aborts an in-flight gateway request", async () => {
    let aborted = false;
    let releaseFetch: () => void = () => {};
    const fetchStarted = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    const runtime = new GatewayAgentRuntime(
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

describe("createAgentRuntime", () => {
  it("defaults the hosted brain to Cloudflare", () => {
    expect(resolveAgentRuntimeKind()).toBe(PRODUCT_RUNTIME);
    expect(resolveAgentRuntimeKind("")).toBe(PRODUCT_RUNTIME);
    expect(() => createAgentRuntime(PRODUCT_RUNTIME, {})).toThrow(/AI binding/);
  });

  it("needs gateway keys unless hosted AI is on", () => {
    expect(agentRuntimeNeedsModel(PRODUCT_RUNTIME, {})).toBe(true);
    expect(
      agentRuntimeNeedsModel(PRODUCT_RUNTIME, {
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_AI_GATEWAY_TOKEN: "gw-token",
      }),
    ).toBe(false);
    expect(
      agentRuntimeNeedsModel("pi", {
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_AI_GATEWAY_TOKEN: "gw-token",
      }),
    ).toBe(false);
    expect(
      agentRuntimeNeedsModel(PRODUCT_RUNTIME, {
        [HOSTED_AI_ENV]: HOSTED_AI_FLAG,
      }),
    ).toBe(false);
  });

  it("keeps the scripted echo for offline tests", async () => {
    const runtime = new ScriptedAgentRuntime();
    const events = [];
    for await (const event of runtime.run(runRequest, adapterContext)) {
      events.push(event);
    }
    expect(events).toContainEqual({
      type: "text",
      text: "Echo: summarize the handoff",
    });
  });

  it("parses poke prompts and waits for the other teammate", async () => {
    expect(parsePokePrompt("hello")).toBeNull();
    expect(parsePokePrompt("poke Lookout: watch the repos")).toEqual({
      name: "Lookout",
      message: "watch the repos",
    });
    const runtime = new ScriptedAgentRuntime();
    const events = [];
    for await (const event of runtime.run(
      {
        ...runRequest,
        prompt: "poke Lookout: watch the repos",
        pokeTeammate: async ({ name, message }) => {
          expect(name).toBe("Lookout");
          expect(message).toBe("watch the repos");
          return "on it";
        },
      },
      adapterContext,
    )) {
      events.push(event);
    }
    expect(events).toContainEqual({
      type: "text",
      text: "Asked Lookout. They said: on it",
    });
  });

  it("brings a failed poke back as a reply", async () => {
    const runtime = new ScriptedAgentRuntime();
    const events = [];
    for await (const event of runtime.run(
      {
        ...runRequest,
        prompt: "poke Lookout: watch the repos",
        pokeTeammate: async () => {
          throw new Error("No teammate named Lookout.");
        },
      },
      adapterContext,
    )) {
      events.push(event);
    }
    expect(events).toContainEqual({
      type: "text",
      text: "No teammate named Lookout.",
    });
    expect(events.some((event) => event.type === "error")).toBe(false);
  });

  it("rejects unknown runtimes", () => {
    expect(() => createAgentRuntime("flue")).toThrow(/Unknown agent runtime/);
    expect(() => createAgentRuntime("mystery")).toThrow(
      /Unknown agent runtime/,
    );
  });
});
