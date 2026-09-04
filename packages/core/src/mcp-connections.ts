import type { McpConnection, PluginStatus, Visibility } from "@groxbot/contracts";
import {
  McpName,
  PluginStatus as PluginStatusSchema,
} from "@groxbot/contracts";
import { type Database, mcpConnections } from "@groxbot/db";
import { and, eq, inArray, ne } from "drizzle-orm";
import { newId } from "./ids.js";
import { iso } from "./threads.js";
import {
  mcpBindableForBot,
  mcpVisibleToViewer,
  parseVisibility,
} from "./visibility.js";

/** Agents `normalizeServerId` truncates to this length. */
const MCP_SERVER_ID_MAX = 64;

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
    visibility: parseVisibility(row.visibility),
    userId: row.userId,
    hostBotId: row.hostBotId,
    lastError: row.lastError,
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(row.updatedAt) ?? new Date().toISOString(),
  };
}

export async function listMcpConnections(
  db: Database,
  workspaceId: string,
  viewerUserId?: string,
): Promise<McpConnection[]> {
  const rows = await db
    .select()
    .from(mcpConnections)
    .where(eq(mcpConnections.workspaceId, workspaceId));
  const listed =
    viewerUserId === undefined
      ? rows
      : rows.filter((row) => mcpVisibleToViewer(row, viewerUserId));
  return listed.map(toMcpDto);
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
  input: { name: string; url: string; visibility?: Visibility },
): Promise<McpConnection> {
  const name = parseMcpName(input.name);
  const url = parseMcpUrl(input.url);
  const visibility = parseVisibility(input.visibility ?? "shared");
  const scope =
    visibility === "private"
      ? and(
          eq(mcpConnections.workspaceId, actor.workspaceId),
          eq(mcpConnections.userId, actor.userId),
          eq(mcpConnections.visibility, "private"),
        )
      : and(
          eq(mcpConnections.workspaceId, actor.workspaceId),
          eq(mcpConnections.visibility, "shared"),
        );
  const [byName] = await db
    .select()
    .from(mcpConnections)
    .where(and(scope, eq(mcpConnections.name, name)))
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
    .where(and(scope, eq(mcpConnections.url, url)))
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
      visibility,
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
    visibility?: Visibility;
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

export async function setMcpVisibility(
  db: Database,
  actor: { workspaceId: string; userId: string },
  id: string,
  visibility: Visibility,
): Promise<McpConnection> {
  const existing = await getMcpConnection(db, actor.workspaceId, id);
  if (!existing || !mcpVisibleToViewer(existing, actor.userId)) {
    throw new McpError("MCP server missing.");
  }
  if (existing.userId !== actor.userId) {
    throw new McpError("Only the owner can share or unshare this MCP.");
  }
  const next = parseVisibility(visibility);
  if (parseVisibility(existing.visibility) === next) return toMcpDto(existing);
  const clashName = await db
    .select({ id: mcpConnections.id })
    .from(mcpConnections)
    .where(
      next === "private"
        ? and(
            eq(mcpConnections.workspaceId, actor.workspaceId),
            eq(mcpConnections.userId, actor.userId),
            eq(mcpConnections.visibility, "private"),
            eq(mcpConnections.name, existing.name),
            ne(mcpConnections.id, existing.id),
          )
        : and(
            eq(mcpConnections.workspaceId, actor.workspaceId),
            eq(mcpConnections.visibility, "shared"),
            eq(mcpConnections.name, existing.name),
            ne(mcpConnections.id, existing.id),
          ),
    )
    .limit(1);
  if (clashName[0]) {
    throw new McpError(
      next === "private"
        ? `You already have a private MCP named “${existing.name}”.`
        : `“${existing.name}” is already a shared MCP.`,
    );
  }
  const clashUrl = await db
    .select({ id: mcpConnections.id })
    .from(mcpConnections)
    .where(
      next === "private"
        ? and(
            eq(mcpConnections.workspaceId, actor.workspaceId),
            eq(mcpConnections.userId, actor.userId),
            eq(mcpConnections.visibility, "private"),
            eq(mcpConnections.url, existing.url),
            ne(mcpConnections.id, existing.id),
          )
        : and(
            eq(mcpConnections.workspaceId, actor.workspaceId),
            eq(mcpConnections.visibility, "shared"),
            eq(mcpConnections.url, existing.url),
            ne(mcpConnections.id, existing.id),
          ),
    )
    .limit(1);
  if (clashUrl[0]) {
    throw new McpError(
      next === "private"
        ? "You already connected that URL as a private MCP."
        : "That URL is already a shared MCP.",
    );
  }
  return saveMcpConnection(db, existing.id, { visibility: next });
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

/** Worker + actor path for MCP OAuth redirects. */
export const MCP_OAUTH_CALLBACK_PATH = "/api/mcp/oauth";

/**
 * Agents `isCallbackRequest` also requires the inbound origin to match the
 * stored callback URL. Wrangler/DO `stub.fetch` often rewrites that host, so
 * the actor matches on path and redeems without the origin check.
 */
export function isMcpOAuthCallbackPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === MCP_OAUTH_CALLBACK_PATH || path.endsWith("/mcp/oauth");
}

/** Stable URL so the home actor sees `/api/mcp/oauth` regardless of inbound host. */
export function mcpOAuthActorUrl(requestUrl: string): string {
  const inbound = new URL(requestUrl);
  const next = new URL(`https://groxbot.internal${MCP_OAUTH_CALLBACK_PATH}`);
  next.search = inbound.search;
  return next.href;
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
export function mcpServerId(input: string): string {
  let id = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  if (id.length === 0 || !/^[a-z]/.test(id)) {
    id = `id-${id}`.replace(/-+$/g, "");
  }
  if (id.length > MCP_SERVER_ID_MAX) {
    id = id.slice(0, MCP_SERVER_ID_MAX).replace(/-+$/g, "");
  }
  return id;
}

/** Agents MCP states that can expose tools inside code. */
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

export type McpLiveServer = {
  name?: string;
  state?: string;
};

export function mcpConnectionIsExecutable(state: string | undefined): boolean {
  return Boolean(state && MCP_EXECUTE_STATES.has(state));
}

export type WorkspaceMcpCatalogRow = {
  id: string;
  name: string;
  status: string;
  hostBotId: string | null;
  visibility: string;
  userId: string;
};

export type McpCatalogBot = {
  visibility: string;
  userId: string;
};

/**
 * Workspace catalog rows this teammate can bind. Live OAuth still sits on
 * `hostBotId`; other home rooms proxy into that actor.
 * Private bot → owner’s private MCP + shared MCP. Shared bot → shared only.
 */
export function mcpCatalogForExecute(
  rows: readonly WorkspaceMcpCatalogRow[],
  bot?: McpCatalogBot,
): Array<{ id: string; name: string; hostBotId: string }> {
  const used = new Set<string>();
  const out: Array<{ id: string; name: string; hostBotId: string }> = [];
  for (const row of rows) {
    if (row.status !== "connected" || !row.hostBotId) continue;
    if (bot && !mcpBindableForBot(row, bot)) continue;
    let name = row.name.trim() || "mcp";
    if (used.has(name)) name = `${name}-${row.id.slice(0, 8)}`;
    used.add(name);
    out.push({ id: row.id, name, hostBotId: row.hostBotId });
  }
  return out;
}

/**
 * Pick live Agents MCP sessions for Code Mode. Catalog `connected` is OAuth
 * only — execute needs an in-memory client that is past authenticating.
 */
export function mcpServersForExecute(
  servers: Record<string, McpLiveServer>,
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

/** Map live Agents MCP state onto the workspace catalog badge. */
export function mcpCatalogStatusFromLive(
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

export function mcpToolNames(tools: unknown): string[] {
  if (!Array.isArray(tools)) return [];
  const names: string[] = [];
  for (const row of tools) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const name = (row as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) names.push(name.trim());
  }
  return names;
}

export function mcpProbeError(caught: unknown): string {
  const raw = caught instanceof Error ? caught.message.trim() : "";
  if (
    !raw ||
    raw === "MCP is not connected." ||
    /^mcp \d+$/.test(raw)
  ) {
    return "Catalog says connected, but the live client is not answering.";
  }
  return raw;
}
