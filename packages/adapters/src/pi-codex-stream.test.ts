import { OPENAI_CODEX_AUTH_ENV } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { resolveOfficePiModel, resolvePiStreamFn } from "./pi-turn.js";

const refresh = "rt_codex_refresh_token_value_ok";
const authJson = JSON.stringify({
  type: "oauth",
  access: "at_live_access_token_value",
  refresh,
  expires: 0,
});

describe("openai-codex office turn", () => {
  it("picks the Codex Responses model even when a hosted gateway is configured", () => {
    const env = {
      [OPENAI_CODEX_AUTH_ENV]: authJson,
      GROXBOT_MODEL: "openai-codex/gpt-5.4",
      GROX_GATEWAY_URL: "https://grox-gateway.example.com",
      GROX_GATEWAY_SECRET: "gw-secret",
    };
    const model = resolveOfficePiModel(env, "openai-codex/gpt-5.4");
    expect(model.provider).toBe("openai-codex");
    expect(model.api).toBe("openai-codex-responses");
    expect(model.id).toBe("gpt-5.4");
    expect(resolvePiStreamFn(env, { modelId: "openai-codex/gpt-5.4" })).not.toBe(
      null,
    );
  });

  it("does not steal hosted GLM turns when ChatGPT is connected", () => {
    const model = resolveOfficePiModel(
      {
        [OPENAI_CODEX_AUTH_ENV]: authJson,
        GROXBOT_MODEL:
          "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-5.3-flash",
        CLOUDFLARE_ACCOUNT_ID: "acct",
        CLOUDFLARE_API_TOKEN: "tok",
      },
      "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-5.3-flash",
    );
    expect(model.provider).toBe("cloudflare-ai-gateway");
  });
});
