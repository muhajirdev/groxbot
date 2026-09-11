import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";
import {
  MODEL_CATALOG,
  OPENAI_CODEX_AUTH_ENV,
  OPENAI_CODEX_PROVIDER,
} from "@groxbot/contracts";
import { describe, expect, it, vi } from "vitest";
import { piAiCodexModelId, refreshOpenAiCodexOAuth } from "./pi-codex-stream.js";
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

  it("lists every pi-ai ChatGPT / Codex model", () => {
    const ours = MODEL_CATALOG.filter(
      (item) => item.provider === OPENAI_CODEX_PROVIDER,
    )
      .map((item) => piAiCodexModelId(item.id))
      .sort();
    const theirs = openaiCodexProvider()
      .getModels()
      .map((model) => model.id)
      .sort();
    expect(ours).toEqual(theirs);
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

function jwtWithAccount(accountId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      "https://api.openai.com/auth": { chatgpt_account_id: accountId },
    }),
  ).toString("base64url");
  return `hdr.${payload}.sig`;
}

describe("openai-codex oauth refresh", () => {
  it("refreshes via auth.openai.com without Pi's Node OAuth loader", async () => {
    const access = jwtWithAccount("acct-80825667");
    const fetchFn = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            access_token: access,
            refresh_token: "rt_rotated_refresh_token_ok",
            expires_in: 3600,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const next = await refreshOpenAiCodexOAuth(
      {
        type: "oauth",
        access: "old-access",
        refresh: "rt_old_refresh_token_value",
        expires: 0,
      },
      new AbortController().signal,
      fetchFn,
    );
    expect(fetchFn).toHaveBeenCalledWith(
      "https://auth.openai.com/oauth/token",
      expect.objectContaining({ method: "POST" }),
    );
    expect(next.access).toBe(access);
    expect(next.refresh).toBe("rt_rotated_refresh_token_ok");
    expect(next.accountId).toBe("acct-80825667");
    expect(next.expires).toBeGreaterThan(Date.now());
  });
});
