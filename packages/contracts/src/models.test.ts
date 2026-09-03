import { describe, expect, it } from "vitest";
import {
  ANTHROPIC_PROVIDER,
  CLOUDFLARE_PROVIDER,
  CUSTOM_MODEL_SENTINEL,
  DEFAULT_AI_GATEWAY_ID,
  gatewayModelId,
  gatewayRequestModel,
  HOSTED_AI_ENV,
  HOSTED_AI_FLAG,
  hostedCloudflareGateway,
  MODEL_CATALOG,
  ModelSettingsSchema,
  missingProviderMessage,
  modelIsRunnable,
  OPENROUTER_PROVIDER,
  PRODUCT_RUNTIME,
  catalogGroupLabel,
  pickerCatalog,
  providerForModel,
  resolveStoredModelId,
  validateCloudflareAccountId,
  validateModelId,
  validateProviderSecret,
} from "./models.js";

describe("model catalog", () => {
  it("maps ids to providers", () => {
    expect(providerForModel("anthropic/claude-sonnet-4-6")).toBe(
      ANTHROPIC_PROVIDER,
    );
    expect(providerForModel("openrouter/deepseek/deepseek-v4-flash")).toBe(
      OPENROUTER_PROVIDER,
    );
    expect(
      providerForModel(
        "cloudflare-ai-gateway/workers-ai/@cf/moonshotai/kimi-k2.6",
      ),
    ).toBe(CLOUDFLARE_PROVIDER);
    expect(providerForModel("@cf/deepseek-ai/deepseek-v4-flash-0731")).toBe(
      CLOUDFLARE_PROVIDER,
    );
  });

  it("normalizes Cloudflare ids for the hosted gateway", () => {
    expect(gatewayModelId("@cf/deepseek-ai/deepseek-v4-flash-0731")).toBe(
      "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
    );
    expect(
      gatewayModelId("cloudflare-ai-gateway/workers-ai/@cf/moonshotai/kimi-k2.6"),
    ).toBe("cloudflare-ai-gateway/workers-ai/@cf/moonshotai/kimi-k2.6");
    expect(gatewayModelId("openrouter/deepseek/deepseek-v4-flash-0731")).toBe(
      "openrouter/deepseek/deepseek-v4-flash",
    );
    expect(
      gatewayModelId(
        "cloudflare-workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
      ),
    ).toBe(
      "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
    );
  });

  it("reads Groxbot’s hosted Cloudflare AI Gateway from env", () => {
    expect(hostedCloudflareGateway({})).toBeNull();
    expect(
      hostedCloudflareGateway({
        CLOUDFLARE_ACCOUNT_ID: "acct",
      }),
    ).toBeNull();
    expect(
      hostedCloudflareGateway({
        [HOSTED_AI_ENV]: HOSTED_AI_FLAG,
        CLOUDFLARE_AI_GATEWAY_ID: "office",
      }),
    ).toEqual({ kind: "binding", gatewayId: "office" });
    expect(
      hostedCloudflareGateway({
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_AI_GATEWAY_TOKEN: "gw-token",
      }),
    ).toEqual({
      kind: "rest",
      accountId: "acct",
      apiToken: "gw-token",
      gatewayId: DEFAULT_AI_GATEWAY_ID,
    });
    expect(
      hostedCloudflareGateway({
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_API_TOKEN: "api-token",
        CLOUDFLARE_AI_GATEWAY_ID: "office",
      }),
    ).toEqual({
      kind: "rest",
      accountId: "acct",
      apiToken: "api-token",
      gatewayId: "office",
    });
  });

  it("strips catalog ids for Cloudflare chat completions", () => {
    expect(
      gatewayRequestModel(
        "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
      ),
    ).toBe("@cf/deepseek-ai/deepseek-v4-flash-0731");
    expect(gatewayRequestModel("openrouter/deepseek/deepseek-v4-flash")).toBe(
      "deepseek/deepseek-v4-flash",
    );
  });

  it("lists Cloudflare models", () => {
    expect(
      MODEL_CATALOG.some((item) => item.provider === CLOUDFLARE_PROVIDER),
    ).toBe(true);
    expect(catalogGroupLabel(CLOUDFLARE_PROVIDER)).toBe("Groxbot");
    expect(catalogGroupLabel(OPENROUTER_PROVIDER)).toBe("OpenRouter");
    const groxOnly = pickerCatalog(
      MODEL_CATALOG,
      "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-5.3-flash",
    );
    expect(groxOnly.every((item) => item.provider === CLOUDFLARE_PROVIDER)).toBe(
      true,
    );
    expect(
      pickerCatalog(MODEL_CATALOG, "openrouter/deepseek/deepseek-v4-flash"),
    ).toHaveLength(MODEL_CATALOG.length);
    expect(MODEL_CATALOG.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
        "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-pro-0813",
        "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-4.7-flash",
        "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-5.2",
        "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-5.3-flash",
      ]),
    );
  });

  it("requires a matching provider key", () => {
    expect(
      modelIsRunnable("anthropic/claude-sonnet-4-6", [OPENROUTER_PROVIDER]),
    ).toBe(false);
    expect(
      modelIsRunnable("openrouter/deepseek/deepseek-v4-flash", [
        OPENROUTER_PROVIDER,
      ]),
    ).toBe(true);
    expect(modelIsRunnable("vendor/custom", [OPENROUTER_PROVIDER])).toBe(true);
  });

  it("validates provider secrets", () => {
    expect(
      validateProviderSecret(ANTHROPIC_PROVIDER, "sk-ant-1234567890"),
    ).toBe(undefined);
    expect(
      validateProviderSecret(ANTHROPIC_PROVIDER, "sk-1234567890ab"),
    ).toMatch(/sk-ant/);
    expect(validateProviderSecret(OPENROUTER_PROVIDER, "••••abcd")).toMatch(
      /hint/,
    );
    expect(validateCloudflareAccountId("not-an-id")).toMatch(/32 hex/);
    expect(
      validateCloudflareAccountId("0123456789abcdef0123456789abcdef"),
    ).toBe(undefined);
  });

  it("resolves custom model ids", () => {
    expect(
      resolveStoredModelId({
        defaultModel: CUSTOM_MODEL_SENTINEL,
        customModel: "openrouter/foo",
      }),
    ).toBe("openrouter/foo");
    expect(missingProviderMessage("anthropic/claude-sonnet-4-6")).toBe(
      "Claude Sonnet 4.6 needs an Anthropic key.",
    );
    expect(
      missingProviderMessage("openrouter/deepseek/deepseek-v4-flash"),
    ).toBe("DeepSeek V4 Flash needs an OpenRouter key.");
  });

  it("rejects keys pasted as model ids", () => {
    expect(validateModelId("sk-ant-abcdefghijklmnopqrstuvwxyz")).toMatch(
      /API key/,
    );
    expect(validateModelId("openrouter/foo")).toBe(undefined);
  });

  it("requires hostedGateway and workspace usage on settings", () => {
    const parsed = ModelSettingsSchema.parse({
      keys: [],
      defaultModel: "custom",
      customModel: "",
      defaultModelId: "openrouter/deepseek/deepseek-v4-flash",
      fromEnv: true,
      hostedGateway: true,
      runtime: PRODUCT_RUNTIME,
      catalog: [],
      warning: null,
      usage: {
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    });
    expect(parsed.hostedGateway).toBe(true);
    expect(parsed.usage.totalTokens).toBe(0);
  });
});
