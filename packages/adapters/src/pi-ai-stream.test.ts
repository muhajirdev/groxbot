import {
  BINDING_STARTER_MODEL,
  CLOUDFLARE_PROVIDER,
  GROXBOT_AUTO_ALLOWED_MODELS,
  HOSTED_STARTER_MODEL,
  OPENROUTER_AUTO_MODEL,
  OPENROUTER_PROVIDER,
} from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { loadGatewayConfig } from "./gateway.js";
import {
  patchOpenRouterAutoBody,
  patchOpenRouterAutoRequest,
  piAiGatewayModelId,
  piAiOpenRouterModelId,
  piAiRequestModel,
  resolvePiAiModel,
} from "./pi-ai-stream.js";

describe("piAiGatewayModelId", () => {
  it("maps the hosted starter id onto the AI Gateway compat catalog id", () => {
    expect(piAiGatewayModelId(BINDING_STARTER_MODEL)).toBe(
      "workers-ai/@cf/zai-org/glm-5.3-flash",
    );
    expect(piAiGatewayModelId("@cf/zai-org/glm-5.3-flash")).toBe(
      "workers-ai/@cf/zai-org/glm-5.3-flash",
    );
    expect(piAiGatewayModelId(HOSTED_STARTER_MODEL)).toBe("groxbot/auto");
    expect(piAiGatewayModelId("auto")).toBe("groxbot/auto");
    expect(piAiGatewayModelId("free")).toBe("groxbot/free");
  });
});

describe("resolvePiAiModel", () => {
  it("points grox-gateway at the worker OpenAI surface", () => {
    const model = resolvePiAiModel(
      loadGatewayConfig({
        GROX_GATEWAY_URL: "https://grox-gateway.example.com",
        GROX_GATEWAY_SECRET: "gw-secret",
      }),
      HOSTED_STARTER_MODEL,
    );
    expect(model.provider).toBe("grox-gateway");
    expect(model.api).toBe("openai-completions");
    expect(model.id).toBe("groxbot/auto");
    expect(model.baseUrl).toBe("https://grox-gateway.example.com/v1");
    expect(model.input).toEqual(["text", "image"]);
    expect(model.reasoning).toBe(true);
    expect(model.compat?.supportsReasoningEffort).toBe(true);
  });

  it("keeps hosted OpenRouter catalog ids as groxbot/ for grox-gateway", () => {
    const model = resolvePiAiModel(
      loadGatewayConfig({
        GROX_GATEWAY_URL: "https://grox-gateway.example.com",
        GROX_GATEWAY_SECRET: "gw-secret",
      }),
      "groxbot/openai/gpt-5.6-luna",
    );
    expect(model.provider).toBe("grox-gateway");
    expect(model.id).toBe("groxbot/openai/gpt-5.6-luna");
    expect(piAiGatewayModelId("groxbot/openai/gpt-5.6-luna")).toBe(
      "groxbot/openai/gpt-5.6-luna",
    );
  });

  it("clones a catalog Workers AI model when GLM 5.3 Flash is missing", () => {
    const model = resolvePiAiModel(
      loadGatewayConfig({
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_API_TOKEN: "tok",
      }),
      BINDING_STARTER_MODEL,
    );
    expect(model.provider).toBe("cloudflare-ai-gateway");
    expect(model.api).toBe("openai-completions");
    expect(model.id).toBe("workers-ai/@cf/zai-org/glm-5.3-flash");
    expect(model.baseUrl).toContain("gateway.ai.cloudflare.com");
    expect(model.baseUrl).toContain("/compat");
  });

  it("looks up OpenRouter catalog models by request id", () => {
    const model = resolvePiAiModel(
      loadGatewayConfig({ OPENROUTER_API_KEY: "sk-or-test" }),
      "openrouter/deepseek/deepseek-v4-flash",
    );
    expect(model.provider).toBe(OPENROUTER_PROVIDER);
    expect(model.id).toBe("deepseek/deepseek-v4-flash");
    expect(piAiRequestModel(CLOUDFLARE_PROVIDER, HOSTED_STARTER_MODEL)).toBe(
      "groxbot/auto",
    );
    expect(piAiRequestModel(CLOUDFLARE_PROVIDER, BINDING_STARTER_MODEL)).toBe(
      "workers-ai/@cf/zai-org/glm-5.3-flash",
    );
    expect(piAiOpenRouterModelId(HOSTED_STARTER_MODEL)).toBe(
      OPENROUTER_AUTO_MODEL,
    );
    expect(piAiOpenRouterModelId(OPENROUTER_AUTO_MODEL)).toBe(
      OPENROUTER_AUTO_MODEL,
    );
  });
});

describe("patchOpenRouterAutoBody", () => {
  it("rewrites catalog Auto onto openrouter/auto with the Luna allowlist", () => {
    const body = patchOpenRouterAutoBody(
      JSON.stringify({
        model: "groxbot/auto",
        messages: [{ role: "user", content: "hey" }],
      }),
      "room-1",
    );
    expect(body).toBeTruthy();
    const parsed = JSON.parse(body ?? "") as {
      model: string;
      session_id: string;
      plugins: Array<{ id: string; allowed_models: string[] }>;
    };
    expect(parsed.model).toBe(OPENROUTER_AUTO_MODEL);
    expect(parsed.session_id).toBe("room-1");
    expect(parsed.plugins).toEqual([
      { id: "auto-router", allowed_models: [...GROXBOT_AUTO_ALLOWED_MODELS] },
    ]);
  });

  it("leaves pinned models alone", () => {
    const raw = JSON.stringify({
      model: "groxbot/openai/gpt-5.6-luna",
      messages: [{ role: "user", content: "hey" }],
    });
    expect(patchOpenRouterAutoBody(raw, "room-1")).toBeNull();
  });

  it("sets x-session-id when rewriting the request", () => {
    const patched = patchOpenRouterAutoRequest(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: "openrouter/auto",
          messages: [{ role: "user", content: "hey" }],
        }),
      },
      "room-9",
    );
    const headers = new Headers(patched.init?.headers);
    expect(headers.get("x-session-id")).toBe("room-9");
    expect(JSON.parse(String(patched.init?.body))).toMatchObject({
      model: OPENROUTER_AUTO_MODEL,
      session_id: "room-9",
    });
  });
});
