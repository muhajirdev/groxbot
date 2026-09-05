import { type Database, mcpConnections } from "@groxbot/db";
import { eq } from "drizzle-orm";
import { getMcpConnectionById } from "./mcp-connections.js";
import { decryptSecret, encryptSecret } from "./secret-box.js";

/**
 * Stable Agents OAuth client name. Must not be the room / teammate id —
 * that would namespace tokens per Durable Object.
 */
export const MCP_OAUTH_CLIENT_NAME = "groxbot-mcp";

export type McpOAuthMap = Record<string, unknown>;

export type McpOAuthStoreDb = {
  load(
    id: string,
  ): Promise<{ workspaceId: string; ciphertext: string | null } | undefined>;
  save(id: string, ciphertext: string | null): Promise<void>;
};

export function mcpOAuthServerIdFromKey(
  key: string,
  clientName = MCP_OAUTH_CLIENT_NAME,
): string | undefined {
  const head = `/${clientName}/`;
  if (!key.startsWith(head)) return undefined;
  const rest = key.slice(head.length);
  if (!rest) return undefined;
  const slash = rest.indexOf("/");
  return slash === -1 ? rest : rest.slice(0, slash);
}

/** Agents stores client info under `/{clientName}/{serverId}/{clientId}/…`. */
export function mcpOAuthClientIdFromKeys(
  keys: readonly string[],
  serverId: string,
  clientName = MCP_OAUTH_CLIENT_NAME,
): string | undefined {
  const prefix = `/${clientName}/${serverId}/`;
  for (const key of keys) {
    if (!key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    const cut = rest.indexOf("/");
    if (cut <= 0) continue;
    const clientId = rest.slice(0, cut);
    const slot = rest.slice(cut + 1).replace(/\/+$/, "");
    if (slot === "token" || slot === "client_info") return clientId;
  }
  return undefined;
}

export function encryptMcpOAuthMap(map: McpOAuthMap, secret: string): string {
  return encryptSecret(JSON.stringify(map), secret);
}

export function decryptMcpOAuthMap(
  ciphertext: string | null | undefined,
  secret: string,
): McpOAuthMap {
  if (!ciphertext) return {};
  try {
    const parsed: unknown = JSON.parse(decryptSecret(ciphertext, secret));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as McpOAuthMap;
  } catch {
    return {};
  }
}

export function postgresMcpOAuthDb(db: Database): McpOAuthStoreDb {
  return {
    async load(id) {
      const row = await getMcpConnectionById(db, id);
      if (!row) return undefined;
      return {
        workspaceId: row.workspaceId,
        ciphertext: row.oauthCiphertext,
      };
    },
    async save(id, ciphertext) {
      const row = await getMcpConnectionById(db, id);
      if (!row) return;
      await db
        .update(mcpConnections)
        .set({ oauthCiphertext: ciphertext, updatedAt: new Date() })
        .where(eq(mcpConnections.id, row.id));
    },
  };
}

/**
 * KV-shaped store for MCP OAuth (PKCE, DCR client info, tokens).
 * One encrypted JSON map per `mcp_connections` row.
 */
export class McpOAuthKv {
  private readonly cache = new Map<string, McpOAuthMap>();

  constructor(
    private readonly opts: {
      workspaceId: () => string;
      secret: () => string;
      db: McpOAuthStoreDb;
      clientName?: string;
    },
  ) {}

  async get<T = unknown>(key: string): Promise<T | undefined>;
  async get<T = unknown>(keys: string[]): Promise<Map<string, T>>;
  async get<T = unknown>(
    keyOrKeys: string | string[],
  ): Promise<T | undefined | Map<string, T>> {
    if (Array.isArray(keyOrKeys)) {
      const out = new Map<string, T>();
      for (const key of keyOrKeys) {
        const value = await this.getOne<T>(key);
        if (value !== undefined) out.set(key, value);
      }
      return out;
    }
    return this.getOne<T>(keyOrKeys);
  }

  async put(key: string, value: unknown): Promise<void>;
  async put(entries: Record<string, unknown>): Promise<void>;
  async put(
    keyOrEntries: string | Record<string, unknown>,
    value?: unknown,
  ): Promise<void> {
    if (typeof keyOrEntries === "string") {
      await this.putOne(keyOrEntries, value);
      return;
    }
    for (const [key, next] of Object.entries(keyOrEntries)) {
      await this.putOne(key, next);
    }
  }

  async delete(key: string): Promise<boolean>;
  async delete(keys: string[]): Promise<number>;
  async delete(keyOrKeys: string | string[]): Promise<boolean | number> {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    let n = 0;
    for (const key of keys) {
      if (await this.deleteOne(key)) n += 1;
    }
    return Array.isArray(keyOrKeys) ? n : n > 0;
  }

  async list<T = unknown>(options?: {
    prefix?: string;
  }): Promise<Map<string, T>> {
    const prefix = options?.prefix ?? "";
    const serverId = mcpOAuthServerIdFromKey(prefix, this.clientName());
    const out = new Map<string, T>();
    if (!serverId) return out;
    const map = await this.loadMap(serverId);
    if (!map) return out;
    for (const [key, value] of Object.entries(map)) {
      if (key.startsWith(prefix)) out.set(key, value as T);
    }
    return out;
  }

  private clientName(): string {
    return this.opts.clientName ?? MCP_OAUTH_CLIENT_NAME;
  }

  private async getOne<T>(key: string): Promise<T | undefined> {
    const serverId = mcpOAuthServerIdFromKey(key, this.clientName());
    if (!serverId) return undefined;
    const map = await this.loadMap(serverId);
    if (!map || !Object.hasOwn(map, key)) return undefined;
    return map[key] as T;
  }

  private async putOne(key: string, value: unknown): Promise<void> {
    const serverId = mcpOAuthServerIdFromKey(key, this.clientName());
    if (!serverId) return;
    const map = (await this.loadMap(serverId)) ?? {};
    map[key] = structuredCloneJson(value);
    await this.persist(serverId, map);
  }

  private async deleteOne(key: string): Promise<boolean> {
    const serverId = mcpOAuthServerIdFromKey(key, this.clientName());
    if (!serverId) return false;
    const map = await this.loadMap(serverId);
    if (!map || !Object.hasOwn(map, key)) return false;
    delete map[key];
    await this.persist(serverId, map);
    return true;
  }

  private async loadMap(serverId: string): Promise<McpOAuthMap | undefined> {
    const cached = this.cache.get(serverId);
    if (cached) return cached;
    const row = await this.opts.db.load(serverId);
    if (!row) return undefined;
    const workspaceId = this.opts.workspaceId();
    if (workspaceId && row.workspaceId !== workspaceId) return undefined;
    const map = decryptMcpOAuthMap(row.ciphertext, this.opts.secret());
    this.cache.set(serverId, map);
    return map;
  }

  private async persist(serverId: string, map: McpOAuthMap): Promise<void> {
    this.cache.set(serverId, map);
    const keys = Object.keys(map);
    const ciphertext =
      keys.length === 0 ? null : encryptMcpOAuthMap(map, this.opts.secret());
    await this.opts.db.save(serverId, ciphertext);
  }
}

function structuredCloneJson(value: unknown): unknown {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}
