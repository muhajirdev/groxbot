import { describe, expect, it } from "vitest";
import {
  MCP_OAUTH_CLIENT_NAME,
  McpOAuthKv,
  decryptMcpOAuthMap,
  encryptMcpOAuthMap,
  mcpOAuthServerIdFromKey,
  type McpOAuthStoreDb,
} from "./mcp-oauth.js";

const secret = "test-encryption-secret-32bytes!!";

function memoryDb(
  rows: Map<string, { workspaceId: string; ciphertext: string | null }>,
): McpOAuthStoreDb {
  return {
    async load(id) {
      return rows.get(id);
    },
    async save(id, ciphertext) {
      const row = rows.get(id);
      if (!row) return;
      rows.set(id, { ...row, ciphertext });
    },
  };
}

describe("mcp oauth postgres kv", () => {
  it("reads the Agents server id out of a storage key", () => {
    expect(
      mcpOAuthServerIdFromKey(
        `/${MCP_OAUTH_CLIENT_NAME}/mcp-11111111-1111-4111-8111-111111111111/client/token`,
      ),
    ).toBe("mcp-11111111-1111-4111-8111-111111111111");
    expect(
      mcpOAuthServerIdFromKey(`/${MCP_OAUTH_CLIENT_NAME}/mcp-1/state/nonce`),
    ).toBe("mcp-1");
    expect(mcpOAuthServerIdFromKey("/other/mcp-1/token")).toBeUndefined();
  });

  it("round-trips an encrypted token map", () => {
    const packed = encryptMcpOAuthMap(
      {
        "/groxbot-mcp/mcp-1/c/token": {
          access_token: "at",
          refresh_token: "rt",
        },
      },
      secret,
    );
    expect(packed.startsWith("groxbot1.")).toBe(true);
    expect(decryptMcpOAuthMap(packed, secret)).toEqual({
      "/groxbot-mcp/mcp-1/c/token": { access_token: "at", refresh_token: "rt" },
    });
    expect(decryptMcpOAuthMap(null, secret)).toEqual({});
  });

  it("stores tokens on the catalog row, not a teammate namespace", async () => {
    const rows = new Map([
      ["mcp-1", { workspaceId: "ws-1", ciphertext: null as string | null }],
    ]);
    const kv = new McpOAuthKv({
      workspaceId: () => "ws-1",
      secret: () => secret,
      db: memoryDb(rows),
    });
    const key = "/groxbot-mcp/mcp-1/oauth-client/token";
    await kv.put(key, { access_token: "at", refresh_token: "rt" });
    expect(await kv.get(key)).toEqual({
      access_token: "at",
      refresh_token: "rt",
    });
    expect(rows.get("mcp-1")?.ciphertext?.startsWith("groxbot1.")).toBe(true);
    const listed = await kv.list({
      prefix: "/groxbot-mcp/mcp-1/oauth-client/",
    });
    expect([...listed.keys()]).toEqual([key]);
    expect(await kv.delete(key)).toBe(true);
    expect(rows.get("mcp-1")?.ciphertext).toBeNull();
  });

  it("does not load another workspace’s ciphertext", async () => {
    const packed = encryptMcpOAuthMap(
      { "/groxbot-mcp/mcp-1/c/token": { access_token: "stolen" } },
      secret,
    );
    const rows = new Map([
      ["mcp-1", { workspaceId: "ws-other", ciphertext: packed }],
    ]);
    const kv = new McpOAuthKv({
      workspaceId: () => "ws-1",
      secret: () => secret,
      db: memoryDb(rows),
    });
    expect(await kv.get("/groxbot-mcp/mcp-1/c/token")).toBeUndefined();
  });
});
