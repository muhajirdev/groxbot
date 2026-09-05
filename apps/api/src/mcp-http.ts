/** Streamable HTTP MCP — Worker isolate, Postgres OAuth. Not Agents `this.mcp`. */
import type { McpConnectionLike } from "@cloudflare/codemode";
import {
  Client,
  StreamableHTTPClientTransport,
  UnauthorizedError,
  type OAuthClientProvider,
  type OAuthDiscoveryState,
  type StoredOAuthClientInformation,
  type StoredOAuthTokens,
} from "@modelcontextprotocol/client";
import {
  encryptionSecret,
  MCP_OAUTH_CALLBACK_PATH,
  MCP_OAUTH_CLIENT_NAME,
  McpOAuthKv,
  mcpOAuthClientIdFromKeys,
  mcpServerId,
  postgresMcpOAuthDb,
} from "@groxbot/core";
import { createNeonHttpDb } from "@groxbot/db/neon";
import { agentRuntimeSource, type Env } from "./env.js";

const CLIENT_INFO = { name: "groxbot", version: "0.0.1" };
const STATE_TTL_MS = 10 * 60 * 1000;

export function mcpCallbackUrl(host: string): string {
  const origin = host.replace(/\/$/, "");
  const path = MCP_OAUTH_CALLBACK_PATH.replace(/^\//, "");
  return `${origin}/${path}`;
}

export function mcpOAuthKv(env: Env, workspaceId: string): McpOAuthKv {
  const source = agentRuntimeSource(env);
  return new McpOAuthKv({
    workspaceId: () => workspaceId,
    secret: () => encryptionSecret(source, env.production),
    db: {
      load: async (id) => {
        const { db } = createNeonHttpDb(env.databaseUrl);
        return postgresMcpOAuthDb(db).load(id);
      },
      save: async (id, ciphertext) => {
        const { db } = createNeonHttpDb(env.databaseUrl);
        await postgresMcpOAuthDb(db).save(id, ciphertext);
      },
    },
  });
}

/**
 * MCP SDK `OAuthClientProvider` backed by encrypted Postgres.
 * Connect, callback, and tool calls stay in the Worker isolate.
 */
export class PostgresMcpOAuthProvider implements OAuthClientProvider {
  authUrl: string | undefined;

  constructor(
    private readonly kv: McpOAuthKv,
    private readonly clientName: string,
    private readonly baseRedirectUrl: string,
    private readonly serverId: string,
  ) {}

  get redirectUrl(): string {
    return this.baseRedirectUrl;
  }

  get clientMetadata() {
    return {
      client_name: this.clientName,
      client_uri: new URL(this.redirectUrl).origin,
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: [this.redirectUrl],
      response_types: ["code"],
      token_endpoint_auth_method: "none" as const,
    };
  }

  private root(): string {
    return `/${this.clientName}/${this.serverId}`;
  }

  private async listed(): Promise<Map<string, unknown>> {
    return this.kv.list({ prefix: `${this.root()}/` });
  }

  private async legacyClientId(): Promise<string | undefined> {
    const keys = [...(await this.listed()).keys()];
    return mcpOAuthClientIdFromKeys(keys, this.serverId, this.clientName);
  }

  async clientInformation(): Promise<StoredOAuthClientInformation | undefined> {
    const fresh = await this.kv.get<StoredOAuthClientInformation>(
      `${this.root()}/client_info`,
    );
    if (fresh) return fresh;
    const clientId = await this.legacyClientId();
    if (!clientId) return undefined;
    return (
      (await this.kv.get<StoredOAuthClientInformation>(
        `${this.root()}/${clientId}/client_info/`,
      )) ?? undefined
    );
  }

  async saveClientInformation(
    clientInformation: StoredOAuthClientInformation,
  ): Promise<void> {
    await this.kv.put(`${this.root()}/client_info`, clientInformation);
  }

  async tokens(): Promise<StoredOAuthTokens | undefined> {
    const fresh = await this.kv.get<StoredOAuthTokens>(`${this.root()}/token`);
    if (fresh) return fresh;
    const clientId = await this.legacyClientId();
    if (!clientId) return undefined;
    return (
      (await this.kv.get<StoredOAuthTokens>(
        `${this.root()}/${clientId}/token`,
      )) ?? undefined
    );
  }

  async saveTokens(tokens: StoredOAuthTokens): Promise<void> {
    await this.kv.put(`${this.root()}/token`, tokens);
    await this.kv.delete(`${this.root()}/oauth_discovery`);
  }

  async saveDiscoveryState(state: OAuthDiscoveryState): Promise<void> {
    await this.kv.put(`${this.root()}/oauth_discovery`, state);
  }

  async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
    return (
      (await this.kv.get<OAuthDiscoveryState>(
        `${this.root()}/oauth_discovery`,
      )) ?? undefined
    );
  }

  async state(): Promise<string> {
    const nonce = crypto.randomUUID();
    const state = `${nonce}.${this.serverId}`;
    await this.kv.put(`${this.root()}/state/${nonce}`, {
      nonce,
      serverId: this.serverId,
      createdAt: Date.now(),
    });
    return state;
  }

  async checkState(state: string): Promise<{
    valid: boolean;
    serverId?: string;
    error?: string;
  }> {
    const cut = state.indexOf(".");
    if (cut <= 0) return { valid: false, error: "Invalid state format" };
    const nonce = state.slice(0, cut);
    const serverId = state.slice(cut + 1);
    if (!nonce || !serverId) {
      return { valid: false, error: "Invalid state format" };
    }
    const key = `${this.root()}/state/${nonce}`;
    const stored = await this.kv.get<{
      nonce: string;
      serverId: string;
      createdAt: number;
    }>(key);
    if (!stored) return { valid: false, error: "State not found or already used" };
    if (stored.serverId !== serverId) {
      await this.kv.delete(key);
      return { valid: false, error: "State serverId mismatch" };
    }
    if (Date.now() - stored.createdAt > STATE_TTL_MS) {
      await this.kv.delete(key);
      return { valid: false, error: "State expired" };
    }
    return { valid: true, serverId };
  }

  async consumeState(state: string): Promise<void> {
    const cut = state.indexOf(".");
    if (cut <= 0) return;
    await this.kv.delete(`${this.root()}/state/${state.slice(0, cut)}`);
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    this.authUrl = authorizationUrl.toString();
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await this.kv.put(`${this.root()}/code_verifier`, codeVerifier);
  }

  async codeVerifier(): Promise<string> {
    const stored = await this.kv.get<string | { verifier?: string }>(
      `${this.root()}/code_verifier`,
    );
    if (typeof stored === "string" && stored) return stored;
    if (stored && typeof stored === "object" && stored.verifier) {
      return stored.verifier;
    }
    throw new Error("No code verifier found");
  }

  async invalidateCredentials(
    scope: "all" | "client" | "tokens" | "verifier" | "discovery",
  ): Promise<void> {
    if (scope === "all" || scope === "discovery") {
      await this.kv.delete(`${this.root()}/oauth_discovery`);
    }
    if (scope === "all" || scope === "client") {
      await this.kv.delete(`${this.root()}/client_info`);
    }
    if (scope === "all" || scope === "tokens") {
      await this.kv.delete(`${this.root()}/token`);
    }
    if (scope === "all" || scope === "verifier") {
      await this.kv.delete(`${this.root()}/code_verifier`);
    }
  }
}

function authProvider(kv: McpOAuthKv, callbackUrl: string, serverId: string) {
  return new PostgresMcpOAuthProvider(
    kv,
    MCP_OAUTH_CLIENT_NAME,
    callbackUrl,
    mcpServerId(serverId),
  );
}

async function openClient(url: string, provider: PostgresMcpOAuthProvider) {
  const client = new Client(CLIENT_INFO);
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    authProvider: provider,
  });
  await client.connect(transport);
  return { client, transport };
}

async function connected(opts: {
  env: Env;
  workspaceId: string;
  id: string;
  url: string;
  callbackHost: string;
}) {
  const kv = mcpOAuthKv(opts.env, opts.workspaceId);
  const provider = authProvider(
    kv,
    mcpCallbackUrl(opts.callbackHost),
    opts.id,
  );
  const { client, transport } = await openClient(opts.url, provider);
  return {
    client,
    close: async () => {
      await transport.close().catch(() => {});
      await client.close().catch(() => {});
    },
  };
}

export async function connectMcpHttp(opts: {
  env: Env;
  workspaceId: string;
  id: string;
  url: string;
  callbackHost: string;
}): Promise<{ state: "connected" | "authenticating"; authUrl?: string }> {
  const kv = mcpOAuthKv(opts.env, opts.workspaceId);
  const provider = authProvider(
    kv,
    mcpCallbackUrl(opts.callbackHost),
    opts.id,
  );
  try {
    const session = await openClient(opts.url, provider);
    await session.transport.close().catch(() => {});
    await session.client.close().catch(() => {});
    return { state: "connected" };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      const authUrl = provider.authUrl;
      if (!authUrl) throw error;
      return { state: "authenticating", authUrl };
    }
    throw error;
  }
}

export async function finishMcpHttpOAuth(opts: {
  env: Env;
  workspaceId: string;
  id: string;
  url: string;
  callbackHost: string;
  searchParams: URLSearchParams;
}): Promise<void> {
  const kv = mcpOAuthKv(opts.env, opts.workspaceId);
  const provider = authProvider(
    kv,
    mcpCallbackUrl(opts.callbackHost),
    opts.id,
  );
  const state = opts.searchParams.get("state") ?? "";
  if (state) {
    const checked = await provider.checkState(state);
    if (!checked.valid) {
      throw new Error(checked.error || "Invalid OAuth state.");
    }
  }
  const transport = new StreamableHTTPClientTransport(new URL(opts.url), {
    authProvider: provider,
  });
  try {
    await transport.finishAuth(opts.searchParams);
    if (state) await provider.consumeState(state);
  } finally {
    await transport.close().catch(() => {});
  }
}

export async function listMcpHttpTools(opts: {
  env: Env;
  workspaceId: string;
  id: string;
  url: string;
  callbackHost: string;
}): Promise<unknown[]> {
  const session = await connected(opts);
  try {
    const listed = await session.client.listTools();
    return listed.tools ?? [];
  } finally {
    await session.close();
  }
}

export function httpMcpConnectionLike(opts: {
  env: Env;
  workspaceId: string;
  id: string;
  name: string;
  url: string;
  callbackHost: string;
}): McpConnectionLike {
  return {
    name: opts.name,
    client: {
      callTool: async (params) => {
        const session = await connected(opts);
        try {
          return await session.client.callTool({
            name: params.name,
            arguments: params.arguments ?? {},
          });
        } finally {
          await session.close();
        }
      },
    },
    fetchTools: async () => {
      const tools = await listMcpHttpTools(opts);
      return tools as never;
    },
  };
}
