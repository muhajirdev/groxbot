import { describe, expect, it } from "vitest";
import { agentRuntimeSource, loadEnv } from "./env.js";

const base = {
  DATABASE_URL: "postgres://groxbot:groxbot@127.0.0.1:5433/groxbot",
  BETTER_AUTH_SECRET: "development-only-change-me-please-32ch",
};

describe("agentRuntimeSource", () => {
  it("marks hosted AI from the Worker binding, not REST tokens", () => {
    const env = loadEnv(base);
    env.hostedAiBinding = true;
    env.cloudflareAiGatewayId = "office";
    const source = agentRuntimeSource(env);
    expect(source.GROXBOT_HOSTED_AI).toBe("1");
    expect(source.CLOUDFLARE_AI_GATEWAY_ID).toBe("office");
    expect(source.CLOUDFLARE_API_TOKEN).toBeUndefined();
    expect(source.CLOUDFLARE_ACCOUNT_ID).toBeUndefined();
  });

  it("keeps REST tokens only for Node self-host hosted fallback", () => {
    const env = loadEnv({
      ...base,
      CLOUDFLARE_ACCOUNT_ID: "acct",
      CLOUDFLARE_AI_GATEWAY_TOKEN: "gw-token",
    });
    const source = agentRuntimeSource(env);
    expect(source.CLOUDFLARE_API_TOKEN).toBe("gw-token");
    expect(source.GROXBOT_HOSTED_AI).toBeUndefined();
  });

  it("omits gateway keys without a binding or REST pack", () => {
    const source = agentRuntimeSource(loadEnv(base));
    expect(source.CLOUDFLARE_API_TOKEN).toBeUndefined();
    expect(source.GROXBOT_HOSTED_AI).toBeUndefined();
  });
});
