import { DURABLE_OBJECT_WAKEUP, HOSTED_AI_ENV, HOSTED_AI_FLAG } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { agentRuntimeSource, loadEnv, productEnv } from "./env.js";

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
    expect(source[HOSTED_AI_ENV]).toBe(HOSTED_AI_FLAG);
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
    expect(source[HOSTED_AI_ENV]).toBeUndefined();
  });

  it("omits gateway keys without a binding or REST pack", () => {
    const source = agentRuntimeSource(loadEnv(base));
    expect(source.CLOUDFLARE_API_TOKEN).toBeUndefined();
    expect(source[HOSTED_AI_ENV]).toBeUndefined();
    expect(source.AGENT_RUNTIME).toBeUndefined();
  });
});

describe("productEnv", () => {
  it("reads Worker string bindings and DO wakeup, not process.env", () => {
    const env = productEnv({
      ...base,
      EMAIL: { send: () => undefined },
      AI: { run: () => undefined },
    });
    expect(env.wakeupKind).toBe(DURABLE_OBJECT_WAKEUP);
    expect(env.emailBinding).toBe(true);
    expect(env.hostedAiBinding).toBe(true);
    expect(env.databaseUrl).toBe(base.DATABASE_URL);
  });
});

describe("loadEnv", () => {
  it("defaults local auth to wrangler, office to Vite", () => {
    const env = loadEnv(base);
    expect(env.authUrl).toBe("http://127.0.0.1:3100");
    expect(env.webOrigin).toBe("http://127.0.0.1:5173");
    expect(env.apiUrl).toBe("http://127.0.0.1:3100");
  });

  it("trusts the Expo app scheme so magic links can return to a device", () => {
    expect(loadEnv(base).corsOrigins).toContain("groxbot://");
  });
});
