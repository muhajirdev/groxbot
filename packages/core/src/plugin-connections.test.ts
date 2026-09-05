import { describe, expect, it } from "vitest";
import {
  composioUserId,
  connectedAccountForTool,
  PluginError,
  parseToolkit,
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
      { toolkit: "gmail", connectedAccountId: "ca_mail" },
      { toolkit: "microsoft_teams", connectedAccountId: "ca_teams" },
    ];
    expect(connectedAccountForTool("GMAIL_SEND_EMAIL", accounts)).toBe(
      "ca_mail",
    );
    expect(
      connectedAccountForTool("MICROSOFT_TEAMS_SEND_MESSAGE", accounts),
    ).toBe("ca_teams");
    expect(connectedAccountForTool("github", accounts)).toBeUndefined();
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
        connectedAccountId: "ca_1",
        lastError: null,
        createdAt: now,
        updatedAt: now,
      }),
    ).toEqual({
      id: "plug-1",
      toolkit: "gmail",
      status: "connected",
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
        connectedAccountId: null,
        lastError: "expired",
        createdAt: now,
        updatedAt: now,
      }).status,
    ).toBe("error");
  });
});
