import { describe, expect, it } from "vitest";
import { agentRuntimeSource, loadEnv } from "./env.js";

const base = {
  DATABASE_URL: "postgres://groxbot:groxbot@127.0.0.1:5433/groxbot",
  BETTER_AUTH_SECRET: "development-only-change-me-please-32ch",
};

describe("agentRuntimeSource", () => {
  it("passes hosted Cloudflare AI Gateway env and skips the email token", () => {
    const env = loadEnv({
      ...base,
      CLOUDFLARE_ACCOUNT_ID: "acct",
      CLOUDFLARE_EMAIL_API_TOKEN: "email-only",
      CLOUDFLARE_AI_GATEWAY_TOKEN: "gw-token",
      CLOUDFLARE_AI_GATEWAY_ID: "office",
    });
    const source = agentRuntimeSource(env);
    expect(source.CLOUDFLARE_ACCOUNT_ID).toBe("acct");
    expect(source.CLOUDFLARE_API_TOKEN).toBe("gw-token");
    expect(source.CLOUDFLARE_AI_GATEWAY_ID).toBe("office");
    expect(source.CLOUDFLARE_EMAIL_API_TOKEN).toBeUndefined();
  });

  it("omits gateway keys when only email sending is configured", () => {
    const env = loadEnv({
      ...base,
      CLOUDFLARE_ACCOUNT_ID: "acct",
      CLOUDFLARE_EMAIL_API_TOKEN: "email-only",
    });
    const source = agentRuntimeSource(env);
    expect(source.CLOUDFLARE_API_TOKEN).toBeUndefined();
    expect(source.CLOUDFLARE_ACCOUNT_ID).toBeUndefined();
  });
});
