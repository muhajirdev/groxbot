import { composioUserId } from "@groxbot/adapter-kit";
import type { PluginConnection, PluginStatus } from "@groxbot/contracts";
import {
  PluginStatus as PluginStatusSchema,
  ToolkitSlug,
} from "@groxbot/contracts";
import { type Database, pluginConnections } from "@groxbot/db";
import { and, eq } from "drizzle-orm";
import { newId } from "./ids.js";
import { iso } from "./threads.js";

export { composioUserId };

export class PluginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginError";
  }
}

export function parseToolkit(value: string): string {
  const parsed = ToolkitSlug.safeParse(value.trim().toLowerCase());
  if (!parsed.success) {
    throw new PluginError("Pick a plugin from the marketplace.");
  }
  return parsed.data;
}

export function toPluginDto(
  row: typeof pluginConnections.$inferSelect,
): PluginConnection {
  const status = PluginStatusSchema.safeParse(row.status);
  return {
    id: row.id,
    toolkit: row.toolkit,
    status: status.success ? status.data : "error",
    connectedAccountId: row.connectedAccountId,
    lastError: row.lastError,
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(row.updatedAt) ?? new Date().toISOString(),
  };
}

export async function listPluginConnections(
  db: Database,
  workspaceId: string,
): Promise<PluginConnection[]> {
  const rows = await db
    .select()
    .from(pluginConnections)
    .where(eq(pluginConnections.workspaceId, workspaceId));
  return rows.map(toPluginDto);
}

export type ConnectedPluginAccount = {
  toolkit: string;
  connectedAccountId?: string;
};

export async function listConnectedPluginAccounts(
  db: Database,
  workspaceId: string,
): Promise<ConnectedPluginAccount[]> {
  const rows = await db
    .select({
      toolkit: pluginConnections.toolkit,
      connectedAccountId: pluginConnections.connectedAccountId,
    })
    .from(pluginConnections)
    .where(
      and(
        eq(pluginConnections.workspaceId, workspaceId),
        eq(pluginConnections.status, "connected"),
      ),
    );
  return rows.map((row) => ({
    toolkit: row.toolkit,
    connectedAccountId: row.connectedAccountId?.trim() || undefined,
  }));
}

export async function listConnectedToolkits(
  db: Database,
  workspaceId: string,
): Promise<string[]> {
  return (await listConnectedPluginAccounts(db, workspaceId)).map(
    (row) => row.toolkit,
  );
}

/** Longest connected toolkit prefix on a Composio tool slug (`GMAIL_SEND_EMAIL` → gmail). */
export function connectedAccountForTool(
  slug: string,
  accounts: readonly ConnectedPluginAccount[],
): string | undefined {
  const normalized = slug.trim().toLowerCase().replace(/-/g, "_");
  if (!normalized) return undefined;
  let best: { id: string; length: number } | undefined;
  for (const account of accounts) {
    const id = account.connectedAccountId?.trim();
    const toolkit = account.toolkit.trim().toLowerCase().replace(/-/g, "_");
    if (!id || !toolkit) continue;
    if (normalized === toolkit || normalized.startsWith(`${toolkit}_`)) {
      if (!best || toolkit.length > best.length) {
        best = { id, length: toolkit.length };
      }
    }
  }
  return best?.id;
}

export async function getPluginConnection(
  db: Database,
  workspaceId: string,
  toolkit: string,
): Promise<typeof pluginConnections.$inferSelect | undefined> {
  const slug = parseToolkit(toolkit);
  const [row] = await db
    .select()
    .from(pluginConnections)
    .where(
      and(
        eq(pluginConnections.workspaceId, workspaceId),
        eq(pluginConnections.toolkit, slug),
      ),
    )
    .limit(1);
  return row;
}

export async function getPluginConnectionById(
  db: Database,
  id: string,
): Promise<typeof pluginConnections.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(pluginConnections)
    .where(eq(pluginConnections.id, id))
    .limit(1);
  return row;
}

export async function addPluginConnection(
  db: Database,
  actor: { workspaceId: string; userId: string },
  toolkit: string,
): Promise<PluginConnection> {
  const slug = parseToolkit(toolkit);
  const existing = await getPluginConnection(db, actor.workspaceId, slug);
  if (existing) return toPluginDto(existing);
  const now = new Date();
  const [row] = await db
    .insert(pluginConnections)
    .values({
      id: newId(),
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      toolkit: slug,
      status: "added",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) throw new PluginError("Could not add plugin.");
  return toPluginDto(row);
}

export async function savePluginConnection(
  db: Database,
  id: string,
  patch: {
    status?: PluginStatus;
    connectedAccountId?: string | null;
    lastError?: string | null;
    userId?: string;
  },
): Promise<PluginConnection> {
  const [row] = await db
    .update(pluginConnections)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(pluginConnections.id, id))
    .returning();
  if (!row) throw new PluginError("Plugin missing.");
  return toPluginDto(row);
}

export async function removePluginConnection(
  db: Database,
  workspaceId: string,
  toolkit: string,
): Promise<typeof pluginConnections.$inferSelect | undefined> {
  const slug = parseToolkit(toolkit);
  const existing = await getPluginConnection(db, workspaceId, slug);
  if (!existing) return undefined;
  await db
    .delete(pluginConnections)
    .where(eq(pluginConnections.id, existing.id));
  return existing;
}
