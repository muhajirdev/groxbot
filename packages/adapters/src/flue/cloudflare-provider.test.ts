import { DEFAULT_AI_GATEWAY_ID } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  CLOUDFLARE_GATEWAY_COMPAT_BASE,
  cloudflareGatewayProviderWithDynamicModels,
} from "./cloudflare-provider.js";

const DYNAMIC_MODEL_TEMPLATE = Symbol.for("flue.dynamicModelTemplate");

const emptyCtx = {
  env: async () => undefined,
  fileExists: async () => false,
};

describe("cloudflareGatewayProviderWithDynamicModels", () => {
  it("keeps Pi catalog models and attaches Flue's dynamic template", () => {
    const provider = cloudflareGatewayProviderWithDynamicModels();
    expect(
      provider
        .getModels()
        .some((model) => model.id === "workers-ai/@cf/moonshotai/kimi-k2.6"),
    ).toBe(true);
    expect(
      provider
        .getModels()
        .some((model) => model.id.includes("deepseek-v4-flash")),
    ).toBe(false);
    expect(provider[DYNAMIC_MODEL_TEMPLATE]).toEqual({
      api: "openai-completions",
      baseUrl: CLOUDFLARE_GATEWAY_COMPAT_BASE,
    });
  });

  it("resolves Cloudflare auth from the workspace overlay, not process.env", async () => {
    const provider = cloudflareGatewayProviderWithDynamicModels({
      CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
      CLOUDFLARE_API_TOKEN: "cf-token-from-settings-123",
      CLOUDFLARE_AI_GATEWAY_ID: DEFAULT_AI_GATEWAY_ID,
    });
    const resolved = await provider.auth.apiKey?.resolve({ ctx: emptyCtx });
    expect(resolved?.auth.headers?.["cf-aig-authorization"]).toBe(
      "Bearer cf-token-from-settings-123",
    );
    expect(resolved?.env?.CLOUDFLARE_ACCOUNT_ID).toBe("a".repeat(32));
    expect(resolved?.env?.CLOUDFLARE_GATEWAY_ID).toBe(DEFAULT_AI_GATEWAY_ID);
  });

  it("stays unconfigured when the overlay has no Cloudflare keys", async () => {
    const provider = cloudflareGatewayProviderWithDynamicModels({});
    expect(await provider.auth.apiKey?.resolve({ ctx: emptyCtx })).toBe(
      undefined,
    );
  });

  it("sees keys added to the overlay object after install", async () => {
    const overlay: NodeJS.ProcessEnv = {};
    const provider = cloudflareGatewayProviderWithDynamicModels(overlay);
    expect(await provider.auth.apiKey?.resolve({ ctx: emptyCtx })).toBe(
      undefined,
    );
    overlay.CLOUDFLARE_ACCOUNT_ID = "b".repeat(32);
    overlay.CLOUDFLARE_API_KEY = "later-token-from-settings";
    overlay.CLOUDFLARE_GATEWAY_ID = DEFAULT_AI_GATEWAY_ID;
    const resolved = await provider.auth.apiKey?.resolve({ ctx: emptyCtx });
    expect(resolved?.auth.headers?.["cf-aig-authorization"]).toBe(
      "Bearer later-token-from-settings",
    );
  });
});
