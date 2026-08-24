import { describe, expect, it } from "vitest";
import {
  CLOUDFLARE_DEEPSEEK_V4_FLASH,
  chatMessages,
  cloudflareChatUrl,
  deltaText,
  gatewayChatUrl,
  gatewayConfigured,
  gatewayErrorMessage,
  gatewayHeaders,
  loadGatewayConfig,
  OPENROUTER_DEEPSEEK_V4_FLASH,
} from "./gateway.js";
import {
  agentRuntimeNeedsModel,
  createAgentRuntime,
  DEFAULT_AGENT_RUNTIME,
  GatewayAgentRuntime,
  OFFLINE_AGENT_RUNTIME,
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

describe("loadGatewayConfig", () => {
  it("defaults Cloudflare to DeepSeek v4 Flash on Workers AI", () => {
    const config = loadGatewayConfig({
      CLOUDFLARE_ACCOUNT_ID: "acct_123",
      CLOUDFLARE_API_TOKEN: "cf-token",
    });
    expect(config.provider).toBe("cloudflare");
    expect(config.model).toBe(CLOUDFLARE_DEEPSEEK_V4_FLASH);
    expect(config.gatewayId).toBe("default");
    expect(gatewayChatUrl(config)).toBe(cloudflareChatUrl("acct_123"));
    expect(gatewayHeaders(config)["cf-aig-gateway-id"]).toBe("default");
    expect(gatewayHeaders(config).authorization).toBe("Bearer cf-token");
  });

  it("defaults OpenRouter to the same DeepSeek v4 Flash release", () => {
    const config = loadGatewayConfig({
      OPENROUTER_API_KEY: "sk-or-test",
    });
    expect(config.provider).toBe("openrouter");
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
    expect(config.provider).toBe("cloudflare");
  });

  it("honors an explicit OpenRouter provider", () => {
    const config = loadGatewayConfig({
      AI_GATEWAY_PROVIDER: "openrouter",
      OPENROUTER_API_KEY: "sk-or-test",
      CLOUDFLARE_ACCOUNT_ID: "acct_123",
      CLOUDFLARE_API_TOKEN: "cf-token",
    });
    expect(config.provider).toBe("openrouter");
  });

  it("throws when no gateway keys are set", () => {
    expect(() => loadGatewayConfig({})).toThrow(/not configured/);
    expect(gatewayConfigured({})).toBe(false);
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
    const seen: Array<{ url: string; model: string; gateway?: string }> = [];
    const runtime = new GatewayAgentRuntime(
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
            };
            seen.push({
              url: String(input),
              model: body.model,
              gateway: headers.get("cf-aig-gateway-id") ?? undefined,
            });
            return sseResponse([], "DeepSeek says hello");
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
        model: CLOUDFLARE_DEEPSEEK_V4_FLASH,
        gateway: "default",
      },
    ]);
    expect(events.at(-2)).toEqual({
      type: "text",
      text: "DeepSeek says hello",
    });
    expect(events.at(-1)).toEqual({
      type: "done",
      text: "DeepSeek says hello",
    });
  });

  it("posts to OpenRouter with the DeepSeek v4 Flash model id", async () => {
    let url = "";
    let model = "";
    const runtime = createAgentRuntime(
      "openrouter",
      { OPENROUTER_API_KEY: "sk-or-test" },
      async (input, init) => {
        url = String(input);
        model = (JSON.parse(String(init?.body ?? "{}")) as { model: string })
          .model;
        return sseResponse([], "OpenRouter hello");
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

  it("reads a non-streaming JSON completion", async () => {
    const runtime = new GatewayAgentRuntime(
      loadGatewayConfig(
        { OPENROUTER_API_KEY: "sk-or-test" },
        {
          fetch: async () =>
            new Response(
              JSON.stringify({
                choices: [{ message: { content: "JSON hello" } }],
              }),
              {
                status: 200,
                headers: { "content-type": "application/json" },
              },
            ),
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
    expect(events).toContainEqual({ type: "error", text: "nope" });
  });

  it("aborts an in-flight gateway request", async () => {
    let aborted = false;
    const runtime = new GatewayAgentRuntime(
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

describe("createAgentRuntime", () => {
  it("defaults the hosted brain to gateway", () => {
    expect(DEFAULT_AGENT_RUNTIME).toBe("gateway");
    expect(resolveAgentRuntimeKind()).toBe("gateway");
    expect(resolveAgentRuntimeKind("")).toBe("gateway");
    expect(resolveAgentRuntimeKind("scripted")).toBe("scripted");
    expect(createAgentRuntime()).toBeInstanceOf(ScriptedAgentRuntime);
    expect(OFFLINE_AGENT_RUNTIME).toBe("scripted");
  });

  it("needs a model id for live flue, not for offline stubs", () => {
    expect(agentRuntimeNeedsModel("scripted", {})).toBe(false);
    expect(agentRuntimeNeedsModel("flue-echo", {})).toBe(false);
    expect(agentRuntimeNeedsModel("flue", {})).toBe(true);
    expect(
      agentRuntimeNeedsModel("flue", {
        GROXBOT_MODEL: "openai/gpt-4o-mini",
      }),
    ).toBe(false);
  });

  it("keeps the scripted echo for offline tests", async () => {
    const runtime = createAgentRuntime("scripted");
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
    expect(() => createAgentRuntime("pi")).toThrow(/Unknown AGENT_RUNTIME/);
  });
});
