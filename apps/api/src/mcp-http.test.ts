import { MCP_OAUTH_CLIENT_NAME, McpOAuthKv } from "@groxbot/core";
import { describe, expect, it } from "vitest";
import { PostgresMcpOAuthProvider } from "./mcp-http.js";

const secret = "test-encryption-secret-32bytes!!";

function memoryKv() {
  const rows = new Map([
    ["mcp-1", { workspaceId: "ws-1", ciphertext: null as string | null }],
  ]);
  return new McpOAuthKv({
    workspaceId: () => "ws-1",
    secret: () => secret,
    db: {
      async load(id) {
        return rows.get(id);
      },
      async save(id, ciphertext) {
        const row = rows.get(id);
        if (!row) return;
        rows.set(id, { ...row, ciphertext });
      },
    },
  });
}

describe("Postgres MCP OAuth provider", () => {
  it("stores tokens and OAuth state on the catalog row", async () => {
    const provider = new PostgresMcpOAuthProvider(
      memoryKv(),
      MCP_OAUTH_CLIENT_NAME,
      "https://api.example/api/mcp/oauth",
      "mcp-1",
    );
    await provider.saveTokens({
      access_token: "at",
      token_type: "Bearer",
    });
    expect(await provider.tokens()).toEqual({
      access_token: "at",
      token_type: "Bearer",
    });
    const state = await provider.state();
    expect(state.endsWith(".mcp-1")).toBe(true);
    expect((await provider.checkState(state)).valid).toBe(true);
  });

  it("reads Agents-shaped token keys from an older row", async () => {
    const kv = memoryKv();
    await kv.put("/groxbot-mcp/mcp-1/oauth-client/token", {
      access_token: "legacy",
      token_type: "Bearer",
    });
    const provider = new PostgresMcpOAuthProvider(
      kv,
      MCP_OAUTH_CLIENT_NAME,
      "https://api.example/api/mcp/oauth",
      "mcp-1",
    );
    expect(await provider.tokens()).toEqual({
      access_token: "legacy",
      token_type: "Bearer",
    });
  });
});
