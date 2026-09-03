import type { McpConnection, PluginStatus } from "@groxbot/contracts";
import {
  McpName,
  PluginStatus as PluginStatusSchema,
} from "@groxbot/contracts";
import { type Database, mcpConnections } from "@groxbot/db";
import { and, eq, inArray } from "drizzle-orm";
import { newId } from "./ids.js";
import { iso } from "./threads.js";

/** Agents `normalizeServerId` truncates to this length. */
const THINK_MCP_SERVER_ID_MAX = 64;

export class McpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpError";
  }
}

export function parseMcpName(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const parsed = McpName.safeParse(slug);
  if (!parsed.success) {
    throw new McpError("Name the server with letters, numbers, and hyphens.");
  }
  return parsed.data;
}

export function parseMcpUrl(value: string): string {
  const raw = value.trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new McpError("Paste a Streamable HTTP MCP URL.");
  }
  if (url.username || url.password) {
    throw new McpError("Do not put credentials in the MCP URL.");
  }
  url.hash = "";
  const host = url.hostname.toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (url.protocol === "http:") {
    if (!local) throw new McpError("Remote MCP must be https.");
  } else if (url.protocol !== "https:") {
    throw new McpError("Paste a Streamable HTTP MCP URL.");
  }
  if (url.href.length > 500) {
    throw new McpError("That MCP URL is too long.");
  }
  return url.href;
}

export function toMcpDto(
  row: typeof mcpConnections.$inferSelect,
): McpConnection {
  const status = PluginStatusSchema.safeParse(row.status);
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    status: status.success ? status.data : "error",
    hostBotId: row.hostBotId,
    lastError: row.lastError,
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(row.updatedAt) ?? new Date().toISOString(),
  };
}

export async function listMcpConnections(
  db: Database,
  workspaceId: string,
): Promise<McpConnection[]> {
  const rows = await db
    .select()
    .from(mcpConnections)
    .where(eq(mcpConnections.workspaceId, workspaceId));
  return rows.map(toMcpDto);
}

export async function getMcpConnection(
  db: Database,
  workspaceId: string,
  id: string,
): Promise<typeof mcpConnections.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(mcpConnections)
    .where(
      and(
        eq(mcpConnections.workspaceId, workspaceId),
        eq(mcpConnections.id, id),
      ),
    )
    .limit(1);
  return row;
}

export async function getMcpConnectionById(
  db: Database,
  id: string,
): Promise<typeof mcpConnections.$inferSelect | undefined> {
  const ids = mcpCatalogIds(id);
  if (ids.length === 0) return undefined;
  const [row] = await db
    .select()
    .from(mcpConnections)
    .where(inArray(mcpConnections.id, ids))
    .limit(1);
  return row;
}

export async function addMcpConnection(
  db: Database,
  actor: { workspaceId: string; userId: string },
  input: { name: string; url: string },
): Promise<McpConnection> {
  const name = parseMcpName(input.name);
  const url = parseMcpUrl(input.url);
  const [byName] = await db
    .select()
    .from(mcpConnections)
    .where(
      and(
        eq(mcpConnections.workspaceId, actor.workspaceId),
        eq(mcpConnections.name, name),
      ),
    )
    .limit(1);
  if (byName) {
    if (byName.url !== url) {
      throw new McpError(`“${name}” is already connected to a different URL.`);
    }
    return toMcpDto(byName);
  }
  const [byUrl] = await db
    .select()
    .from(mcpConnections)
    .where(
      and(
        eq(mcpConnections.workspaceId, actor.workspaceId),
        eq(mcpConnections.url, url),
      ),
    )
    .limit(1);
  if (byUrl) return toMcpDto(byUrl);
  const now = new Date();
  const [row] = await db
    .insert(mcpConnections)
    .values({
      // Letter prefix so Agents `normalizeServerId` does not rewrite a UUID.
      id: `mcp-${newId()}`,
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      name,
      url,
      status: "added",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) throw new McpError("Could not add MCP server.");
  return toMcpDto(row);
}

export async function saveMcpConnection(
  db: Database,
  id: string,
  patch: {
    status?: PluginStatus;
    hostBotId?: string | null;
    lastError?: string | null;
    userId?: string;
  },
): Promise<McpConnection> {
  const existing = await getMcpConnectionById(db, id);
  if (!existing) throw new McpError("MCP server missing.");
  const [row] = await db
    .update(mcpConnections)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(mcpConnections.id, existing.id))
    .returning();
  if (!row) throw new McpError("MCP server missing.");
  return toMcpDto(row);
}

export async function removeMcpConnection(
  db: Database,
  workspaceId: string,
  id: string,
): Promise<typeof mcpConnections.$inferSelect | undefined> {
  const existing = await getMcpConnection(db, workspaceId, id);
  if (!existing) return undefined;
  await db.delete(mcpConnections).where(eq(mcpConnections.id, existing.id));
  return existing;
}

/**
 * Agents OAuth state is `{nonce}.{serverId}`. Older guesses used
 * `{serverId}:{nonce}`; keep that as a fallback.
 */
export function mcpOauthServerId(state: string | undefined): string {
  const raw = state?.trim() ?? "";
  if (!raw) return "";
  const dot = raw.indexOf(".");
  if (dot !== -1) {
    const serverId = raw.slice(dot + 1).trim();
    if (serverId && !serverId.includes(".")) return serverId;
  }
  const cut = raw.indexOf(":");
  return (cut === -1 ? raw : raw.slice(0, cut)).trim();
}

/**
 * Agents prefixes `id-` when a server id does not start with a letter, so a
 * UUID catalog row must also be tried without that prefix.
 */
export function mcpCatalogIds(serverId: string): string[] {
  const id = serverId.trim();
  if (!id) return [];
  const ids = [id];
  if (id.startsWith("id-") && id.length > 3) ids.push(id.slice(3));
  return ids;
}

/** Same rules as Agents `normalizeServerId` for MCP client storage keys. */
export function thinkMcpServerId(input: string): string {
  let id = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  if (id.length === 0 || !/^[a-z]/.test(id)) {
    id = `id-${id}`.replace(/-+$/g, "");
  }
  if (id.length > THINK_MCP_SERVER_ID_MAX) {
    id = id.slice(0, THINK_MCP_SERVER_ID_MAX).replace(/-+$/g, "");
  }
  return id;
}

/** Think MCP states that can expose tools inside execute. */
export const MCP_EXECUTE_STATES = new Set([
  "ready",
  "connected",
  "discovering",
]);

/** Wait for OAuth connect+discover before the callback response returns. */
export const MCP_OAUTH_SETTLE_MS = 30_000;

export type McpExecuteServer = {
  id: string;
  name: string;
};

export type McpLiveConnection = {
  connectionState?: string;
  name?: string;
};

export type McpThinkServer = {
  name?: string;
  state?: string;
};

export function mcpConnectionIsExecutable(state: string | undefined): boolean {
  return Boolean(state && MCP_EXECUTE_STATES.has(state));
}

/**
 * Pick live Think MCP sessions for Code Mode. Catalog `connected` is OAuth
 * only — execute needs an in-memory client that is past authenticating.
 */
export function mcpServersForExecute(
  servers: Record<string, McpThinkServer>,
  connections: Record<string, McpLiveConnection | undefined>,
): McpExecuteServer[] {
  const used = new Set<string>();
  const out: McpExecuteServer[] = [];
  const ids = new Set([...Object.keys(servers), ...Object.keys(connections)]);
  for (const id of ids) {
    const connection = connections[id];
    if (!connection) continue;
    const server = servers[id];
    const state = connection.connectionState ?? server?.state;
    if (!mcpConnectionIsExecutable(state)) continue;
    let name = (server?.name ?? connection.name ?? "").trim() || "mcp";
    if (used.has(name)) name = `${name}-${id.slice(0, 8)}`;
    used.add(name);
    out.push({ id, name });
  }
  return out;
}

/** Map Think’s live MCP state onto the workspace catalog badge. */
export function mcpCatalogStatusFromThink(
  connectionState: string | undefined,
  authSuccess: boolean,
): { status: PluginStatus; lastError: string | null } {
  if (!authSuccess) {
    return { status: "error", lastError: "Authentication failed" };
  }
  if (mcpConnectionIsExecutable(connectionState)) {
    return { status: "connected", lastError: null };
  }
  if (connectionState === "failed") {
    return {
      status: "error",
      lastError: "MCP connection failed after OAuth.",
    };
  }
  return { status: "connecting", lastError: null };
}
