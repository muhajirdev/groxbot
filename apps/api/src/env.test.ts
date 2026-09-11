import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DURABLE_OBJECT_WAKEUP, HOSTED_AI_ENV, HOSTED_AI_FLAG } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { agentRuntimeSource, loadEnv, productEnv, requireCatalogDb } from "./env.js";

const base = {
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

  it("treats grox-gateway as the included hosted catalog", () => {
    const env = loadEnv({
      ...base,
      GROX_GATEWAY_URL: "https://gateway.groxbot.com",
      GROX_GATEWAY_SECRET: "gw-secret",
    });
    const source = agentRuntimeSource(env);
    expect(source.GROX_GATEWAY_URL).toBe("https://gateway.groxbot.com");
    expect(source[HOSTED_AI_ENV]).toBe(HOSTED_AI_FLAG);
  });

  it("forwards the Codex Fly proxy onto the runtime overlay", () => {
    const env = loadEnv({
      ...base,
      GROX_GATEWAY_URL: "https://gateway.groxbot.com",
      GROX_GATEWAY_SECRET: "gw-secret",
      GROXBOT_CODEX_PROXY_URL: "https://groxbot-codex.fly.dev",
      GROXBOT_CODEX_PROXY_SECRET: "proxy-secret",
    });
    const source = agentRuntimeSource(env);
    expect(source.GROXBOT_CODEX_PROXY_URL).toBe("https://groxbot-codex.fly.dev");
    expect(source.GROXBOT_CODEX_PROXY_SECRET).toBe("proxy-secret");
  });
});

describe("requireCatalogDb", () => {
  it("fails closed without a DB binding", () => {
    expect(() => requireCatalogDb({})).toThrow(/DB D1 binding is required/);
    expect(requireCatalogDb({ DB: { tag: "d1" } })).toEqual({ tag: "d1" });
  });

  it("binds Worker catalog DB in wrangler.jsonc", () => {
    const wrangler = readFileSync(
      join(import.meta.dirname, "../wrangler.jsonc"),
      "utf8",
    );
    expect(wrangler).toMatch(/"binding": "DB"/);
    expect(wrangler).toMatch(/"database_name": "groxbot"/);
    expect(wrangler).toMatch(
      /"migrations_dir": "\.\.\/\.\.\/packages\/db\/drizzle"/,
    );
    expect(wrangler).not.toMatch(/DATABASE_URL/);
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
    expect(env.databasePath).toBeUndefined();
  });

  it("turns hosted billing on from Polar Worker secrets", () => {
    const env = productEnv({
      ...base,
      POLAR_ACCESS_TOKEN: " polar_oat_test ",
      POLAR_WEBHOOK_SECRET: " whsec_test ",
      POLAR_ENVIRONMENT: "production",
    });
    expect(env.polarAccessToken).toBe("polar_oat_test");
    expect(env.polarWebhookSecret).toBe("whsec_test");
    expect(env.polarEnvironment).toBe("production");
  });
});

describe("loadEnv", () => {
  it("does not require DATABASE_URL", () => {
    expect(loadEnv(base).databasePath).toBeUndefined();
    expect(
      loadEnv({ ...base, DATABASE_PATH: "data/groxbot.sqlite" }).databasePath,
    ).toBe("data/groxbot.sqlite");
  });

  it("defaults local auth to wrangler, office to Vite", () => {
    const env = loadEnv(base);
    expect(env.authUrl).toBe("http://127.0.0.1:3100");
    expect(env.webOrigin).toBe("http://127.0.0.1:5173");
    expect(env.landingOrigin).toBe("http://127.0.0.1:5174");
    expect(env.apiUrl).toBe("http://127.0.0.1:3100");
    expect(env.tinyfishApiKey).toBeUndefined();
    expect(env.tinyfishApiKeys).toEqual([]);
  });

  it("reads the TinyFish key for office web search", () => {
    expect(
      loadEnv({ ...base, TINYFISH_API_KEY: " tf-test " }).tinyfishApiKey,
    ).toBe("tf-test");
  });

  it("parses a TinyFish key pool", () => {
    const env = loadEnv({
      ...base,
      TINYFISH_API_KEY: "tf-one",
      TINYFISH_API_KEYS: "tf-two, tf-three",
    });
    expect(env.tinyfishApiKeys).toEqual(["tf-two", "tf-three", "tf-one"]);
    expect(env.tinyfishApiKey).toBe("tf-two");
  });

  it("trusts the Expo app scheme so magic links can return to a device", () => {
    expect(loadEnv(base).corsOrigins).toContain("groxbot://");
  });

  it("keeps Polar off until an access token is set", () => {
    expect(loadEnv(base).polarAccessToken).toBeUndefined();
    expect(loadEnv(base).polarEnvironment).toBe("sandbox");
    expect(
      loadEnv({ ...base, POLAR_ACCESS_TOKEN: "polar_oat_test" })
        .polarAccessToken,
    ).toBe("polar_oat_test");
  });

  it("pairs the landing host with the office origin", () => {
    expect(
      loadEnv({
        ...base,
        WEB_ORIGIN: "https://app.groxbot.com",
      }).landingOrigin,
    ).toBe("https://groxbot.com");
    expect(
      loadEnv({
        ...base,
        LANDING_ORIGIN: "https://pages.example/",
      }).landingOrigin,
    ).toBe("https://pages.example");
  });
});
