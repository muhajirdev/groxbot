import type { McpConnection, PluginStatus } from "@groxbot/contracts";
import { McpName, PluginStatus as PluginStatusSchema } from "@groxbot/contracts";
import { type Database, mcpConnections } from "@groxbot/db";
import { and, eq } from "drizzle-orm";
import { newId } from "./ids.js";
import { iso } from "./threads.js";

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
  const local =
    host === "localhost" || host === "127.0.0.1" || host === "::1";
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
      and(eq(mcpConnections.workspaceId, workspaceId), eq(mcpConnections.id, id)),
    )
    .limit(1);
  return row;
}

export async function getMcpConnectionById(
  db: Database,
  id: string,
): Promise<typeof mcpConnections.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(mcpConnections)
    .where(eq(mcpConnections.id, id))
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
      id: newId(),
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
  const [row] = await db
    .update(mcpConnections)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(mcpConnections.id, id))
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

export function mcpOauthServerId(state: string | undefined): string {
  const raw = state?.trim() ?? "";
  const cut = raw.indexOf(":");
  return (cut === -1 ? raw : raw.slice(0, cut)).trim();
}
