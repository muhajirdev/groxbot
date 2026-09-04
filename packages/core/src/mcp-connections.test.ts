import { describe, expect, it } from "vitest";
import {
  McpError,
  isMcpOAuthCallbackPath,
  mcpCatalogForExecute,
  mcpCatalogIds,
  mcpCatalogStatusFromLive,
  mcpOAuthActorUrl,
  mcpOauthServerId,
  mcpProbeError,
  mcpServersForExecute,
  mcpToolNames,
  parseMcpName,
  parseMcpUrl,
  mcpServerId,
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

  it("recognizes the Worker MCP OAuth callback path", () => {
    expect(isMcpOAuthCallbackPath("/api/mcp/oauth")).toBe(true);
    expect(isMcpOAuthCallbackPath("/api/mcp/oauth/")).toBe(true);
    expect(isMcpOAuthCallbackPath("/mcp/add")).toBe(false);
  });

  it("rewrites the OAuth callback onto the actor path without dropping state", () => {
    expect(
      mcpOAuthActorUrl(
        "http://127.0.0.1:3100/api/mcp/oauth?code=abc&state=nonce.mcp-1",
      ),
    ).toBe("https://groxbot.internal/api/mcp/oauth?code=abc&state=nonce.mcp-1");
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

  it("maps Agents’ id- prefix back to a UUID catalog row", () => {
    expect(mcpCatalogIds("id-5729b24b-c968-4504-925a-ae9451f326cc")).toEqual([
      "id-5729b24b-c968-4504-925a-ae9451f326cc",
      "5729b24b-c968-4504-925a-ae9451f326cc",
    ]);
    expect(mcpCatalogIds("mcp-11111111-1111-4111-8111-111111111111")).toEqual([
      "mcp-11111111-1111-4111-8111-111111111111",
    ]);
  });

  it("prefixes digit UUIDs the way Agents normalizeServerId does", () => {
    expect(mcpServerId("5729b24b-c968-4504-925a-ae9451f326cc")).toBe(
      "id-5729b24b-c968-4504-925a-ae9451f326cc",
    );
    expect(mcpServerId("mcp-11111111-1111-4111-8111-111111111111")).toBe(
      "mcp-11111111-1111-4111-8111-111111111111",
    );
    expect(mcpServerId("a729b24b-c968-4504-925a-ae9451f326cc")).toBe(
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
        visibility: "shared",
        lastError: null,
        createdAt: now,
        updatedAt: now,
      }),
    ).toEqual({
      id: "mcp-1",
      name: "linear",
      url: "https://mcp.linear.app/mcp",
      status: "connected",
      visibility: "shared",
      userId: "user-1",
      hostBotId: "bot-1",
      lastError: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });

  it("binds connected workspace catalog rows for every teammate", () => {
    expect(
      mcpCatalogForExecute([
        {
          id: "mcp-1",
          name: "mimpimu",
          status: "connected",
          hostBotId: "bot-1",
          visibility: "shared",
          userId: "user-1",
        },
        {
          id: "mcp-2",
          name: "github",
          status: "connecting",
          hostBotId: "bot-1",
          visibility: "shared",
          userId: "user-1",
        },
        {
          id: "mcp-3",
          name: "orphan",
          status: "connected",
          hostBotId: null,
          visibility: "shared",
          userId: "user-1",
        },
      ]),
    ).toEqual([{ id: "mcp-1", name: "mimpimu", hostBotId: "bot-1" }]);
  });

  it("gives a private bot the owner’s private MCP plus shared MCP", () => {
    const rows = [
      {
        id: "mcp-shared",
        name: "mimpimu",
        status: "connected",
        hostBotId: "bot-shared",
        visibility: "shared",
        userId: "user-office",
      },
      {
        id: "mcp-alice",
        name: "gmail",
        status: "connected",
        hostBotId: "bot-alice",
        visibility: "private",
        userId: "user-alice",
      },
      {
        id: "mcp-bob",
        name: "gmail-bob",
        status: "connected",
        hostBotId: "bot-bob",
        visibility: "private",
        userId: "user-bob",
      },
    ];
    expect(
      mcpCatalogForExecute(rows, {
        visibility: "private",
        userId: "user-alice",
      }),
    ).toEqual([
      { id: "mcp-shared", name: "mimpimu", hostBotId: "bot-shared" },
      { id: "mcp-alice", name: "gmail", hostBotId: "bot-alice" },
    ]);
    expect(
      mcpCatalogForExecute(rows, {
        visibility: "shared",
        userId: "user-alice",
      }),
    ).toEqual([
      { id: "mcp-shared", name: "mimpimu", hostBotId: "bot-shared" },
    ]);
  });

  it("exposes live MCP sessions, not just catalog-ready rows", () => {
    expect(
      mcpServersForExecute(
        {
          "mcp-1": { name: "mimpimu", state: "authenticating" },
          "mcp-2": { name: "github", state: "ready" },
        },
        {
          "mcp-1": { connectionState: "ready" },
          "mcp-2": undefined,
        },
      ),
    ).toEqual([{ id: "mcp-1", name: "mimpimu" }]);
  });

  it("keeps connected and discovering sessions in execute", () => {
    expect(
      mcpServersForExecute(
        { a: { name: "linear", state: "connected" } },
        { a: { connectionState: "connected" } },
      ),
    ).toEqual([{ id: "a", name: "linear" }]);
    expect(
      mcpServersForExecute(
        { a: { name: "linear", state: "discovering" } },
        { a: { connectionState: "discovering" } },
      ),
    ).toEqual([{ id: "a", name: "linear" }]);
  });

  it("skips authenticating and failed live clients", () => {
    expect(
      mcpServersForExecute(
        {
          a: { name: "one", state: "authenticating" },
          b: { name: "two", state: "failed" },
        },
        {
          a: { connectionState: "authenticating" },
          b: { connectionState: "failed" },
        },
      ),
    ).toEqual([]);
  });

  it("disambiguates duplicate MCP names", () => {
    expect(
      mcpServersForExecute(
        {
          "mcp-aaaaaaa1": { name: "linear", state: "ready" },
          "mcp-bbbbbbb2": { name: "linear", state: "ready" },
        },
        {
          "mcp-aaaaaaa1": { connectionState: "ready" },
          "mcp-bbbbbbb2": { connectionState: "ready" },
        },
      ),
    ).toEqual([
      { id: "mcp-aaaaaaa1", name: "linear" },
      { id: "mcp-bbbbbbb2", name: "linear-mcp-bbbb" },
    ]);
  });

  it("maps live MCP state onto the Plugins badge", () => {
    expect(mcpCatalogStatusFromLive("ready", true)).toEqual({
      status: "connected",
      lastError: null,
    });
    expect(mcpCatalogStatusFromLive("connected", true)).toEqual({
      status: "connected",
      lastError: null,
    });
    expect(mcpCatalogStatusFromLive("authenticating", true)).toEqual({
      status: "connecting",
      lastError: null,
    });
    expect(mcpCatalogStatusFromLive("failed", true)).toEqual({
      status: "error",
      lastError: "MCP connection failed after OAuth.",
    });
    expect(mcpCatalogStatusFromLive("ready", false)).toEqual({
      status: "error",
      lastError: "Authentication failed",
    });
  });

  it("lists MCP tool names from a live tools payload", () => {
    expect(
      mcpToolNames([
        { name: "list_dreams" },
        { name: "  " },
        { description: "no name" },
        "skip",
      ]),
    ).toEqual(["list_dreams"]);
  });

  it("explains a catalog-only MCP that is not answering", () => {
    expect(mcpProbeError(new Error("MCP is not connected."))).toBe(
      "Catalog says connected, but the live client is not answering.",
    );
    expect(mcpProbeError(new Error("mcp 404"))).toBe(
      "Catalog says connected, but the live client is not answering.",
    );
    expect(mcpProbeError(new Error("upstream timeout"))).toBe(
      "upstream timeout",
    );
  });
});
