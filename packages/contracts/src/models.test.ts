import { describe, expect, it } from "vitest";
import {
  catalogForRuntime,
  flueModelId,
  missingProviderMessage,
  modelIsRunnable,
  providerForModel,
  resolveStoredModelId,
  validateCloudflareAccountId,
  validateModelId,
  validateProviderSecret,
} from "./models.js";

describe("model catalog", () => {
  it("maps ids to providers", () => {
    expect(providerForModel("anthropic/claude-sonnet-4-6")).toBe("anthropic");
    expect(providerForModel("openrouter/deepseek/deepseek-v4-flash")).toBe(
      "openrouter",
    );
    expect(
      providerForModel(
        "cloudflare-ai-gateway/workers-ai/@cf/moonshotai/kimi-k2.6",
      ),
    ).toBe("cloudflare");
    expect(providerForModel("@cf/deepseek-ai/deepseek-v4-flash-0731")).toBe(
      "cloudflare",
    );
  });

  it("normalizes Cloudflare ids for Flue/Pi", () => {
    expect(flueModelId("@cf/deepseek-ai/deepseek-v4-flash-0731")).toBe(
      "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
    );
    expect(
      flueModelId("cloudflare-ai-gateway/workers-ai/@cf/moonshotai/kimi-k2.6"),
    ).toBe("cloudflare-ai-gateway/workers-ai/@cf/moonshotai/kimi-k2.6");
    expect(flueModelId("openrouter/deepseek/deepseek-v4-flash-0731")).toBe(
      "openrouter/deepseek/deepseek-v4-flash",
    );
    expect(
      flueModelId(
        "cloudflare-workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
      ),
    ).toBe(
      "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
    );
  });

  it("lists Cloudflare models for every runtime", () => {
    expect(
      catalogForRuntime("flue").some((item) => item.provider === "cloudflare"),
    ).toBe(true);
    expect(
      catalogForRuntime("gateway").some(
        (item) => item.provider === "cloudflare",
      ),
    ).toBe(true);
    expect(catalogForRuntime("flue").map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
        "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-pro-0813",
        "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-4.7-flash",
        "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-5.2",
      ]),
    );
  });

  it("requires a matching provider key", () => {
    expect(modelIsRunnable("anthropic/claude-sonnet-4-6", ["openrouter"])).toBe(
      false,
    );
    expect(
      modelIsRunnable("openrouter/deepseek/deepseek-v4-flash", ["openrouter"]),
    ).toBe(true);
    expect(modelIsRunnable("vendor/custom", ["openrouter"])).toBe(true);
  });

  it("validates provider secrets", () => {
    expect(validateProviderSecret("anthropic", "sk-ant-1234567890")).toBe(
      undefined,
    );
    expect(validateProviderSecret("anthropic", "sk-1234567890ab")).toMatch(
      /sk-ant/,
    );
    expect(validateProviderSecret("openrouter", "••••abcd")).toMatch(/hint/);
    expect(validateCloudflareAccountId("not-an-id")).toMatch(/32 hex/);
    expect(
      validateCloudflareAccountId("0123456789abcdef0123456789abcdef"),
    ).toBe(undefined);
  });

  it("resolves custom model ids", () => {
    expect(
      resolveStoredModelId({
        defaultModel: "custom",
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
});
