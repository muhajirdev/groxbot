import {
  CLOUDFLARE_PROVIDER,
  HOSTED_STARTER_MODEL,
  OPENROUTER_PROVIDER,
} from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { loadGatewayConfig } from "./gateway.js";
import {
  piAiGatewayModelId,
  piAiRequestModel,
  resolvePiAiModel,
} from "./pi-ai-stream.js";

describe("piAiGatewayModelId", () => {
  it("maps the hosted starter id onto the AI Gateway compat catalog id", () => {
    expect(piAiGatewayModelId(HOSTED_STARTER_MODEL)).toBe(
      "workers-ai/@cf/zai-org/glm-5.3-flash",
    );
    expect(piAiGatewayModelId("@cf/zai-org/glm-5.3-flash")).toBe(
      "workers-ai/@cf/zai-org/glm-5.3-flash",
    );
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
    expect(model.provider).toBe(OPENROUTER_PROVIDER);
    expect(model.api).toBe("openai-completions");
    expect(model.id).toBe("workers-ai/@cf/zai-org/glm-5.3-flash");
    expect(model.baseUrl).toBe("https://grox-gateway.example.com/v1");
  });

  it("clones a catalog Workers AI model when GLM 5.3 Flash is missing", () => {
    const model = resolvePiAiModel(
      loadGatewayConfig({
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_API_TOKEN: "tok",
      }),
      HOSTED_STARTER_MODEL,
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
      "workers-ai/@cf/zai-org/glm-5.3-flash",
    );
  });
});
