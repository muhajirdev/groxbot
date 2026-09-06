import { composioUserId } from "@groxbot/adapter-kit";
import type {
  PluginConnection,
  PluginStatus,
  Visibility,
} from "@groxbot/contracts";
import {
  PluginStatus as PluginStatusSchema,
  ToolkitSlug,
} from "@groxbot/contracts";
import { type Database, pluginConnections } from "@groxbot/db";
import { and, eq } from "drizzle-orm";
import { newId } from "./ids.js";
import { iso } from "./threads.js";
import {
  parseVisibility,
  pluginBindableForBot,
  pluginVisibleToViewer,
} from "./visibility.js";

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
    visibility: parseVisibility(row.visibility),
    userId: row.userId,
    connectedAccountId: row.connectedAccountId,
    lastError: row.lastError,
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(row.updatedAt) ?? new Date().toISOString(),
  };
}

export async function listPluginConnections(
  db: Database,
  workspaceId: string,
  viewerUserId?: string,
): Promise<PluginConnection[]> {
  const rows = await db
    .select()
    .from(pluginConnections)
    .where(eq(pluginConnections.workspaceId, workspaceId));
  const listed =
    viewerUserId === undefined
      ? rows
      : rows.filter((row) => pluginVisibleToViewer(row, viewerUserId));
  return listed.map(toPluginDto);
}

export type ConnectedPluginAccount = {
  id: string;
  toolkit: string;
  connectedAccountId?: string;
  visibility: Visibility;
  userId: string;
};

export type PluginCatalogBot = {
  visibility: string;
  userId: string;
};

export function pluginCatalogForExecute(
  rows: readonly {
    id: string;
    toolkit: string;
    status: string;
    visibility: string;
    userId: string;
    connectedAccountId?: string | null;
  }[],
  bot?: PluginCatalogBot,
): ConnectedPluginAccount[] {
  const out: ConnectedPluginAccount[] = [];
  for (const row of rows) {
    if (row.status !== "connected") continue;
    const connectedAccountId = row.connectedAccountId?.trim();
    if (!connectedAccountId) continue;
    if (bot && !pluginBindableForBot(row, bot)) continue;
    out.push({
      id: row.id,
      toolkit: row.toolkit,
      connectedAccountId,
      visibility: parseVisibility(row.visibility),
      userId: row.userId,
    });
  }
  return out;
}

export async function listConnectedPluginAccounts(
  db: Database,
  workspaceId: string,
  bot?: PluginCatalogBot,
): Promise<ConnectedPluginAccount[]> {
  const rows = await db
    .select({
      id: pluginConnections.id,
      toolkit: pluginConnections.toolkit,
      status: pluginConnections.status,
      visibility: pluginConnections.visibility,
      userId: pluginConnections.userId,
      connectedAccountId: pluginConnections.connectedAccountId,
    })
    .from(pluginConnections)
    .where(eq(pluginConnections.workspaceId, workspaceId));
  return pluginCatalogForExecute(rows, bot);
}

export async function listConnectedToolkits(
  db: Database,
  workspaceId: string,
  bot?: PluginCatalogBot,
): Promise<string[]> {
  return [
    ...new Set(
      (await listConnectedPluginAccounts(db, workspaceId, bot)).map(
        (row) => row.toolkit,
      ),
    ),
  ];
}

export function pluginAccountsForTool(
  slug: string,
  accounts: readonly ConnectedPluginAccount[],
): ConnectedPluginAccount[] {
  const normalized = slug.trim().toLowerCase().replace(/-/g, "_");
  if (!normalized) return [];
  const matches: ConnectedPluginAccount[] = [];
  let bestLength = 0;
  for (const account of accounts) {
    const toolkit = account.toolkit.trim().toLowerCase().replace(/-/g, "_");
    if (!toolkit || !account.connectedAccountId) continue;
    if (normalized === toolkit || normalized.startsWith(`${toolkit}_`)) {
      if (toolkit.length > bestLength) {
        bestLength = toolkit.length;
        matches.length = 0;
        matches.push(account);
      } else if (toolkit.length === bestLength) {
        matches.push(account);
      }
    }
  }
  return matches;
}

/** Longest connected toolkit prefix. Undefined when several accounts match. */
export function connectedAccountForTool(
  slug: string,
  accounts: readonly ConnectedPluginAccount[],
  preferredId?: string,
): string | undefined {
  const preferred = preferredId?.trim();
  if (preferred) {
    const hit = accounts.find(
      (row) => row.id === preferred || row.connectedAccountId === preferred,
    );
    if (hit?.connectedAccountId) return hit.connectedAccountId;
  }
  const matches = pluginAccountsForTool(slug, accounts);
  if (matches.length !== 1) return undefined;
  return matches[0]?.connectedAccountId;
}

export async function getPluginConnection(
  db: Database,
  workspaceId: string,
  id: string,
): Promise<typeof pluginConnections.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(pluginConnections)
    .where(
      and(
        eq(pluginConnections.workspaceId, workspaceId),
        eq(pluginConnections.id, id),
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
  visibility?: Visibility,
): Promise<PluginConnection> {
  const slug = parseToolkit(toolkit);
  const now = new Date();
  const [row] = await db
    .insert(pluginConnections)
    .values({
      id: newId(),
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      toolkit: slug,
      status: "added",
      visibility: parseVisibility(visibility ?? "shared"),
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
    visibility?: Visibility;
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

export async function setPluginVisibility(
  db: Database,
  actor: { workspaceId: string; userId: string },
  id: string,
  visibility: Visibility,
): Promise<PluginConnection> {
  const existing = await getPluginConnection(db, actor.workspaceId, id);
  if (!existing || !pluginVisibleToViewer(existing, actor.userId)) {
    throw new PluginError("Plugin missing.");
  }
  if (existing.userId !== actor.userId) {
    throw new PluginError("Only the owner can share or unshare this plugin.");
  }
  const next = parseVisibility(visibility);
  if (parseVisibility(existing.visibility) === next) {
    return toPluginDto(existing);
  }
  return savePluginConnection(db, existing.id, { visibility: next });
}

export async function removePluginConnection(
  db: Database,
  workspaceId: string,
  id: string,
): Promise<typeof pluginConnections.$inferSelect | undefined> {
  const existing = await getPluginConnection(db, workspaceId, id);
  if (!existing) return undefined;
  await db
    .delete(pluginConnections)
    .where(eq(pluginConnections.id, existing.id));
  return existing;
}
