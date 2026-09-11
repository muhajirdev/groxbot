import { moonshotaiProvider } from "@earendil-works/pi-ai/providers/moonshotai";
import { zaiProvider } from "@earendil-works/pi-ai/providers/zai";
import {
  MOONSHOT_API_KEY_ENV,
  MOONSHOT_CHAT_BASE_URL,
  MOONSHOT_PROVIDER,
  ZAI_API_KEY_ENV,
  ZAI_CHAT_BASE_URL,
  ZAI_PROVIDER,
} from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  nativeCompatRequestModel,
  resolveNativeCompatModel,
} from "./pi-native-compat.js";
import { resolveOfficePiModel, resolvePiStreamFn } from "./pi-turn.js";

describe("native z.ai / Moonshot office turn", () => {
  it("uses the general z.ai OpenAI-compat URL, not the Coding Plan endpoint", () => {
    const model = resolveNativeCompatModel("zai/glm-5.3");
    expect(model.provider).toBe(ZAI_PROVIDER);
    expect(model.api).toBe("openai-completions");
    expect(model.id).toBe("glm-5.3");
    expect(model.baseUrl).toBe(ZAI_CHAT_BASE_URL);
    expect(model.baseUrl).not.toContain("/coding/");
    expect(zaiProvider().baseUrl).toContain("/coding/");
  });

  it("uses Moonshot's documented OpenAI-compat URL", () => {
    const model = resolveNativeCompatModel("moonshot/kimi-k2.6");
    expect(model.provider).toBe(MOONSHOT_PROVIDER);
    expect(model.api).toBe("openai-completions");
    expect(model.id).toBe("kimi-k2.6");
    expect(model.baseUrl).toBe(MOONSHOT_CHAT_BASE_URL);
    expect(moonshotaiProvider().baseUrl).toBe(MOONSHOT_CHAT_BASE_URL);
  });

  it("strips catalog prefixes for the chat-completions model id", () => {
    expect(nativeCompatRequestModel("zai/glm-5.3-flash")).toBe("glm-5.3-flash");
    expect(nativeCompatRequestModel("moonshot/kimi-k2.5")).toBe("kimi-k2.5");
  });

  it("wins over hosted grox-gateway for native catalog ids", () => {
    const env = {
      [ZAI_API_KEY_ENV]: "zai-test-key-123456",
      GROXBOT_MODEL: "zai/glm-5.3",
      GROX_GATEWAY_URL: "https://grox-gateway.example.com",
      GROX_GATEWAY_SECRET: "gw-secret",
    };
    const model = resolveOfficePiModel(env, "zai/glm-5.3");
    expect(model.provider).toBe(ZAI_PROVIDER);
    expect(model.baseUrl).toBe(ZAI_CHAT_BASE_URL);
    expect(resolvePiStreamFn(env, { modelId: "zai/glm-5.3" })).not.toBe(null);
  });

  it("does not steal Workers AI GLM turns when a z.ai key is on file", () => {
    const model = resolveOfficePiModel(
      {
        [ZAI_API_KEY_ENV]: "zai-test-key-123456",
        GROXBOT_MODEL:
          "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-5.3-flash",
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_API_TOKEN: "tok",
      },
      "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-5.3-flash",
    );
    expect(model.provider).toBe("cloudflare-ai-gateway");
  });

  it("does not steal Workers AI Kimi turns when a Moonshot key is on file", () => {
    const model = resolveOfficePiModel(
      {
        [MOONSHOT_API_KEY_ENV]: "sk-moonshotkey12",
        GROXBOT_MODEL:
          "cloudflare-ai-gateway/workers-ai/@cf/moonshotai/kimi-k2.6",
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_API_TOKEN: "tok",
      },
      "cloudflare-ai-gateway/workers-ai/@cf/moonshotai/kimi-k2.6",
    );
    expect(model.provider).toBe("cloudflare-ai-gateway");
  });

  it("returns a missing-key stream instead of falling through to grox-gateway", () => {
    const env = {
      GROXBOT_MODEL: "moonshot/kimi-k2.6",
      GROX_GATEWAY_URL: "https://grox-gateway.example.com",
      GROX_GATEWAY_SECRET: "gw-secret",
    };
    const model = resolveOfficePiModel(env, "moonshot/kimi-k2.6");
    expect(model.provider).toBe(MOONSHOT_PROVIDER);
    expect(resolvePiStreamFn(env, { modelId: "moonshot/kimi-k2.6" })).not.toBe(
      null,
    );
  });
});
