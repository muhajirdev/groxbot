import { describe, expect, it } from "vitest";
import {
  McpError,
  mcpCatalogIds,
  mcpOauthServerId,
  parseMcpName,
  parseMcpUrl,
  thinkMcpServerId,
  toMcpDto,
} from "./mcp-connections.js";

describe("mcp connections", () => {
  it("slugs a display name", () => {
    expect(parseMcpName("Linear")).toBe("linear");
    expect(parseMcpName("My MCP")).toBe("my-mcp");
  });

  it("rejects empty names", () => {
    expect(() => parseMcpName("")).toThrow(McpError);
    expect(() => parseMcpName("***")).toThrow(McpError);
  });

  it("keeps https remotes and local http", () => {
    expect(parseMcpUrl("https://mcp.linear.app/mcp/")).toBe(
      "https://mcp.linear.app/mcp/",
    );
    expect(parseMcpUrl("http://127.0.0.1:3333/mcp")).toBe(
      "http://127.0.0.1:3333/mcp",
    );
  });

  it("rejects remote http and credentials in the URL", () => {
    expect(() => parseMcpUrl("http://mcp.example.com/mcp")).toThrow(McpError);
    expect(() => parseMcpUrl("https://user:pass@mcp.example.com/mcp")).toThrow(
      McpError,
    );
  });

  it("reads the server id from an Agents OAuth state", () => {
    expect(
      mcpOauthServerId(
        "gs-YXhdpL0L_VoUXaO1HH.id-5729b24b-c968-4504-925a-ae9451f326cc",
      ),
    ).toBe("id-5729b24b-c968-4504-925a-ae9451f326cc");
    expect(
      mcpOauthServerId("nonce.mcp-11111111-1111-4111-8111-111111111111"),
    ).toBe("mcp-11111111-1111-4111-8111-111111111111");
    expect(mcpOauthServerId("abc-1:nonce")).toBe("abc-1");
    expect(mcpOauthServerId("abc-1")).toBe("abc-1");
    expect(mcpOauthServerId(undefined)).toBe("");
  });

  it("maps Think’s id- prefix back to a UUID catalog row", () => {
    expect(mcpCatalogIds("id-5729b24b-c968-4504-925a-ae9451f326cc")).toEqual([
      "id-5729b24b-c968-4504-925a-ae9451f326cc",
      "5729b24b-c968-4504-925a-ae9451f326cc",
    ]);
    expect(mcpCatalogIds("mcp-11111111-1111-4111-8111-111111111111")).toEqual([
      "mcp-11111111-1111-4111-8111-111111111111",
    ]);
  });

  it("prefixes digit UUIDs the way Agents normalizeServerId does", () => {
    expect(thinkMcpServerId("5729b24b-c968-4504-925a-ae9451f326cc")).toBe(
      "id-5729b24b-c968-4504-925a-ae9451f326cc",
    );
    expect(thinkMcpServerId("mcp-11111111-1111-4111-8111-111111111111")).toBe(
      "mcp-11111111-1111-4111-8111-111111111111",
    );
    expect(thinkMcpServerId("a729b24b-c968-4504-925a-ae9451f326cc")).toBe(
      "a729b24b-c968-4504-925a-ae9451f326cc",
    );
  });

  it("maps a row onto the contract", () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    expect(
      toMcpDto({
        id: "mcp-1",
        workspaceId: "ws-1",
        userId: "user-1",
        hostBotId: "bot-1",
        name: "linear",
        url: "https://mcp.linear.app/mcp",
        status: "connected",
        lastError: null,
        createdAt: now,
        updatedAt: now,
      }),
    ).toEqual({
      id: "mcp-1",
      name: "linear",
      url: "https://mcp.linear.app/mcp",
      status: "connected",
      hostBotId: "bot-1",
      lastError: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });
});
