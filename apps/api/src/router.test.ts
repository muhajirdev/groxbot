import {
  HTTP_WAKEUP,
  IN_PROCESS_WAKEUP,
  MAIL_CLOUDFLARE,
  MAIL_LOG,
} from "@groxbot/contracts";
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
  production: false,
  wakeupKind: IN_PROCESS_WAKEUP,
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
    expect(healthPayload(env).wakeup).toBe(IN_PROCESS_WAKEUP);
    expect(healthPayload({ ...env, wakeupKind: HTTP_WAKEUP }).wakeup).toBe(
      HTTP_WAKEUP,
    );
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
    await expect(client.bots.delete({ botId: "bot_test" })).rejects.toMatchObject(
      {
        code: "UNAUTHORIZED",
      },
    );
    await expect(client.rooms.list()).rejects.toMatchObject({
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
    await expect(client.mcp.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(client.mcp.probe({ id: "mcp_1" })).rejects.toMatchObject({
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
    expect(healthPayload(env).mail).toBe(MAIL_LOG);
    expect(
      healthPayload({
        ...env,
        emailBinding: true,
        emailFrom: "Groxbot <noreply@groxbot.com>",
      }).mail,
    ).toBe(MAIL_CLOUDFLARE);
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

  it("requires a session to list or switch workspaces", async () => {
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
    await expect(client.workspaces.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      client.workspaces.activate({ workspaceId: "ws_1" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("requires a session to update a workspace", async () => {
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
    await expect(
      client.workspaces.update({ name: "Acme" }),
    ).rejects.toMatchObject({
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

  it("requires a session to list a bot computer", async () => {
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
    await expect(
      client.computer.list({ botId: "bot_test" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      client.computer.write({
        botId: "bot_test",
        filename: "notes.md",
        content: "YWJj",
      }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      client.computer.download({ botId: "bot_test", path: "notes.md" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("requires a session to list knowledge", async () => {
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
    await expect(client.knowledge.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      client.knowledge.search({ query: "standup" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      client.knowledge.read({ path: "playbooks/weekly-update/SKILL.md" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      client.knowledge.download({ path: "brief.pdf" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      client.knowledge.backlinks({ path: "how-we-work/constraints.md" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(client.knowledge.graph()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      client.knowledge.importSkill({ source: "acme/playbooks" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
