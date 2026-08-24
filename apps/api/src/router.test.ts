import { createGroxbotClient } from "@groxbot/rpc";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { RpcContext } from "./context.js";
import { healthPayload } from "./health.js";
import { mountRpc } from "./rpc.js";

const env = {
  databaseUrl: "postgres://groxbot:groxbot@127.0.0.1:5433/groxbot",
  authSecret: "development-only-change-me-please-32ch",
  authUrl: "http://127.0.0.1:5173",
  webOrigin: "http://127.0.0.1:5173",
  corsOrigins: ["http://127.0.0.1:5173"],
  sandboxProvider: "fake",
  agentRuntime: "scripted",
  production: false,
  wakeupKind: "in-process",
} as const;

describe("oRPC", () => {
  it("serves health over the contract", async () => {
    const app = new Hono();
    mountRpc(app, { env } as unknown as RpcContext);
    const client = createGroxbotClient({
      baseUrl: "http://groxbot.test",
      fetch: async (input, init) => {
        const request =
          input instanceof Request ? input : new Request(String(input), init);
        return app.request(request);
      },
    });
    await expect(client.health()).resolves.toEqual(healthPayload(env));
  });

  it("reports in-process wakeup when the worker is local", () => {
    expect(healthPayload(env).wakeup).toBe("in-process");
    expect(healthPayload({ ...env, wakeupKind: "http" }).wakeup).toBe("http");
  });

  it("lists Google and GitHub when those keys are set", () => {
    expect(
      healthPayload({
        ...env,
        googleClientId: "google-id",
        googleClientSecret: "google-secret",
        githubClientId: "github-id",
        githubClientSecret: "github-secret",
      }).oauth,
    ).toEqual(["google", "github"]);
  });

  it("requires a session to list bots", async () => {
    const app = new Hono();
    mountRpc(app, { env } as unknown as RpcContext);
    const client = createGroxbotClient({
      baseUrl: "http://groxbot.test",
      fetch: async (input, init) => {
        const request =
          input instanceof Request ? input : new Request(String(input), init);
        return app.request(request);
      },
    });
    await expect(client.bots.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("requires a session to list plugins", async () => {
    const app = new Hono();
    mountRpc(app, { env } as unknown as RpcContext);
    const client = createGroxbotClient({
      baseUrl: "http://groxbot.test",
      fetch: async (input, init) => {
        const request =
          input instanceof Request ? input : new Request(String(input), init);
        return app.request(request);
      },
    });
    await expect(client.plugins.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("reports whether Composio is configured", () => {
    expect(healthPayload(env).composio).toBe(false);
    expect(healthPayload({ ...env, composioApiKey: "ak_test" }).composio).toBe(
      true,
    );
  });

  it("reports Cloudflare mail when the EMAIL binding and from address are set", () => {
    expect(healthPayload(env).mail).toBe("log");
    expect(
      healthPayload({
        ...env,
        emailBinding: true,
        emailFrom: "Groxbot <noreply@groxbot.com>",
      }).mail,
    ).toBe("cloudflare");
  });

  it("requires a session to load model settings", async () => {
    const app = new Hono();
    mountRpc(app, { env } as unknown as RpcContext);
    const client = createGroxbotClient({
      baseUrl: "http://groxbot.test",
      fetch: async (input, init) => {
        const request =
          input instanceof Request ? input : new Request(String(input), init);
        return app.request(request);
      },
    });
    await expect(client.models.get()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("requires a session to list apps", async () => {
    const app = new Hono();
    mountRpc(app, { env } as unknown as RpcContext);
    const client = createGroxbotClient({
      baseUrl: "http://groxbot.test",
      fetch: async (input, init) => {
        const request =
          input instanceof Request ? input : new Request(String(input), init);
        return app.request(request);
      },
    });
    await expect(client.apps.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
