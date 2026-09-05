import { describe, expect, it } from "vitest";
import {
  ComposioError,
  composioConfigured,
  composioUserId,
  createComposioGateway,
  createPluginTools,
  formatComposioResult,
  HttpComposioGateway,
  requireComposioKey,
  SdkComposioGateway,
} from "./composio.js";

describe("Composio adapter", () => {
  it("scopes users to the workspace", () => {
    expect(composioUserId("ws-9")).toBe("groxbot:ws:ws-9");
  });

  it("treats a missing key as unconfigured", () => {
    expect(composioConfigured({})).toBe(false);
    expect(composioConfigured({ COMPOSIO_API_KEY: "  " })).toBe(false);
    expect(composioConfigured({ COMPOSIO_API_KEY: "ak_live" })).toBe(true);
    expect(() => requireComposioKey({})).toThrow(ComposioError);
    expect(() => requireComposioKey({})).toThrow(/COMPOSIO_API_KEY/);
  });

  it("does not build tools without a key or toolkits", () => {
    expect(
      createPluginTools({
        workspaceId: "ws-1",
        toolkits: ["gmail"],
        env: {},
      }),
    ).toBeUndefined();
    expect(
      createPluginTools({
        workspaceId: "ws-1",
        toolkits: [],
        env: { COMPOSIO_API_KEY: "ak" },
      }),
    ).toBeUndefined();
  });

  it("starts an OAuth link through authorize", async () => {
    const gateway = new SdkComposioGateway({
      toolkits: {
        authorize: async () => ({
          redirectUrl: "https://connect.composio.dev/link",
          id: "ca_1",
        }),
      },
    });
    await expect(
      gateway.link({
        userId: "groxbot:ws:1",
        toolkit: "gmail",
        callbackUrl: "http://127.0.0.1:3100/api/plugins/callback?id=1",
      }),
    ).resolves.toEqual({
      redirectUrl: "https://connect.composio.dev/link",
      connectedAccountId: "ca_1",
    });
  });

  it("formats tool results for the model", () => {
    expect(formatComposioResult({ ok: true })).toBe(
      JSON.stringify({ ok: true }, null, 2),
    );
  });

  it("lists active accounts from the SDK shape", async () => {
    const gateway = createComposioGateway(
      { COMPOSIO_API_KEY: "ak" },
      {
        connectedAccounts: {
          list: async () => ({
            items: [
              {
                id: "ca_gmail",
                status: "ACTIVE",
                toolkit: { slug: "gmail" },
              },
            ],
          }),
        },
      },
    );
    await expect(gateway.listAccounts("groxbot:ws:1")).resolves.toEqual([
      { id: "ca_gmail", toolkit: "gmail", status: "ACTIVE" },
    ]);
  });

  it("creates a connect link over HTTP", async () => {
    const calls: string[] = [];
    const gateway = new HttpComposioGateway("ak", async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/auth_configs") && init?.method === "POST") {
        return jsonResponse({ auth_config: { id: "ac_1" } }, 201);
      }
      if (url.includes("/auth_configs")) {
        return jsonResponse({ items: [] });
      }
      if (url.includes("/connected_accounts/link")) {
        return jsonResponse({
          redirect_url: "https://connect.composio.dev/x",
          id: "ca_new",
        });
      }
      return jsonResponse({ error: { message: url } }, 404);
    });
    await expect(
      gateway.link({
        userId: "groxbot:ws:1",
        toolkit: "gmail",
        callbackUrl: "http://127.0.0.1:3100/api/plugins/callback?id=1",
      }),
    ).resolves.toEqual({
      redirectUrl: "https://connect.composio.dev/x",
      connectedAccountId: "ca_new",
    });
    expect(calls.some((item) => item.includes("connected_accounts/link"))).toBe(
      true,
    );
  });

  it("reads a string toolkit field on connected accounts", async () => {
    const gateway = new HttpComposioGateway("ak", async () =>
      jsonResponse({
        items: [{ id: "ca_slack", status: "ACTIVE", toolkit: "slack" }],
      }),
    );
    await expect(gateway.listAccounts("groxbot:ws:1")).resolves.toEqual([
      { id: "ca_slack", toolkit: "slack", status: "ACTIVE" },
    ]);
  });

  it("searches connected toolkits and returns slim hits", async () => {
    const gateway = new HttpComposioGateway("ak", async (input) => {
      const url = String(input);
      expect(url).toMatch(/query=send/);
      expect(url).toMatch(/toolkit_slug=gmail/);
      return jsonResponse({
        items: [
          {
            slug: "GMAIL_SEND_EMAIL",
            name: "Send Email",
            description: "Send a Gmail message",
            toolkit: { slug: "gmail" },
          },
          {
            slug: "SLACK_SEND_MESSAGE",
            name: "Send Slack",
            toolkit: { slug: "slack" },
          },
        ],
      });
    });
    await expect(
      gateway.search({
        userId: "groxbot:ws:1",
        query: "send",
        toolkits: ["gmail"],
      }),
    ).resolves.toEqual([
      {
        slug: "GMAIL_SEND_EMAIL",
        name: "Send Email",
        description: "Send a Gmail message",
        toolkit: "gmail",
      },
    ]);
  });

  it("executes a tool with the connected account id", async () => {
    let body = "";
    const gateway = new HttpComposioGateway("ak", async (input, init) => {
      body = String(init?.body ?? "");
      expect(String(input)).toMatch(/\/tools\/execute\/GMAIL_SEND_EMAIL$/);
      return jsonResponse({ data: { id: "msg_1" } });
    });
    await expect(
      gateway.execute({
        userId: "groxbot:ws:1",
        slug: "GMAIL_SEND_EMAIL",
        arguments: { to: "a@b.com" },
        connectedAccountId: "ca_mail",
      }),
    ).resolves.toEqual({ data: { id: "msg_1" } });
    expect(JSON.parse(body)).toMatchObject({
      user_id: "groxbot:ws:1",
      connected_account_id: "ca_mail",
      arguments: { to: "a@b.com" },
    });
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
