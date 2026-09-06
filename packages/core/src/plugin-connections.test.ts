import { describe, expect, it } from "vitest";
import {
  composioUserId,
  connectedAccountForTool,
  PluginError,
  parseToolkit,
  pluginAccountsForTool,
  pluginCatalogForExecute,
  toPluginDto,
} from "./plugin-connections.js";

describe("plugin connections", () => {
  it("scopes Composio users to the workspace", () => {
    expect(composioUserId("ws-1")).toBe("groxbot:ws:ws-1");
  });

  it("accepts marketplace slugs", () => {
    expect(parseToolkit("Gmail")).toBe("gmail");
    expect(parseToolkit("google-calendar")).toBe("google-calendar");
    expect(parseToolkit("microsoft_teams")).toBe("microsoft_teams");
    expect(parseToolkit("_1password")).toBe("_1password");
  });

  it("rejects empty or noisy slugs", () => {
    expect(() => parseToolkit("")).toThrow(PluginError);
    expect(() => parseToolkit("gmail.send")).toThrow(PluginError);
    expect(() => parseToolkit("GMAIL SEND")).toThrow(PluginError);
  });

  it("picks the longest connected toolkit prefix for a tool slug", () => {
    const accounts = [
      {
        id: "p1",
        toolkit: "gmail",
        connectedAccountId: "ca_mail",
        visibility: "shared" as const,
        userId: "u1",
      },
      {
        id: "p2",
        toolkit: "microsoft_teams",
        connectedAccountId: "ca_teams",
        visibility: "shared" as const,
        userId: "u1",
      },
    ];
    expect(connectedAccountForTool("GMAIL_SEND_EMAIL", accounts)).toBe(
      "ca_mail",
    );
    expect(
      connectedAccountForTool("MICROSOFT_TEAMS_SEND_MESSAGE", accounts),
    ).toBe("ca_teams");
    expect(connectedAccountForTool("github", accounts)).toBeUndefined();
  });

  it("does not guess when several Gmail accounts are connected", () => {
    const accounts = [
      {
        id: "work",
        toolkit: "gmail",
        connectedAccountId: "ca_work",
        visibility: "shared" as const,
        userId: "u1",
      },
      {
        id: "personal",
        toolkit: "gmail",
        connectedAccountId: "ca_home",
        visibility: "private" as const,
        userId: "u2",
      },
    ];
    expect(pluginAccountsForTool("GMAIL_SEND_EMAIL", accounts)).toHaveLength(2);
    expect(
      connectedAccountForTool("GMAIL_SEND_EMAIL", accounts),
    ).toBeUndefined();
    expect(
      connectedAccountForTool("GMAIL_SEND_EMAIL", accounts, "personal"),
    ).toBe("ca_home");
    expect(
      connectedAccountForTool("GMAIL_SEND_EMAIL", accounts, "ca_work"),
    ).toBe("ca_work");
  });

  it("maps a row onto the contract", () => {
    const now = new Date("2026-08-17T00:00:00.000Z");
    expect(
      toPluginDto({
        id: "plug-1",
        workspaceId: "ws-1",
        userId: "user-1",
        toolkit: "gmail",
        status: "connected",
        visibility: "private",
        connectedAccountId: "ca_1",
        lastError: null,
        createdAt: now,
        updatedAt: now,
      }),
    ).toEqual({
      id: "plug-1",
      toolkit: "gmail",
      status: "connected",
      visibility: "private",
      userId: "user-1",
      connectedAccountId: "ca_1",
      lastError: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });

  it("treats unknown DB status as error", () => {
    const now = new Date("2026-08-17T00:00:00.000Z");
    expect(
      toPluginDto({
        id: "plug-2",
        workspaceId: "ws-1",
        userId: "user-1",
        toolkit: "gmail",
        status: "nope",
        visibility: "shared",
        connectedAccountId: null,
        lastError: "expired",
        createdAt: now,
        updatedAt: now,
      }).status,
    ).toBe("error");
  });

  it("binds private plugin accounts only to the owner’s private teammate", () => {
    const rows = [
      {
        id: "shared-mail",
        toolkit: "gmail",
        status: "connected",
        visibility: "shared",
        userId: "alice",
        connectedAccountId: "ca_office",
      },
      {
        id: "private-mail",
        toolkit: "gmail",
        status: "connected",
        visibility: "private",
        userId: "alice",
        connectedAccountId: "ca_alice",
      },
    ];
    expect(
      pluginCatalogForExecute(rows, {
        visibility: "shared",
        userId: "alice",
      }).map((row) => row.id),
    ).toEqual(["shared-mail"]);
    expect(
      pluginCatalogForExecute(rows, {
        visibility: "private",
        userId: "alice",
      }).map((row) => row.id),
    ).toEqual(["shared-mail", "private-mail"]);
    expect(
      pluginCatalogForExecute(rows, {
        visibility: "private",
        userId: "bob",
      }).map((row) => row.id),
    ).toEqual(["shared-mail"]);
  });
});
