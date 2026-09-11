import {
  type Database,
  bots,
  deploymentSettings,
  knowledgeShares,
  mcpConnections,
  member,
  organization,
  pluginConnections,
  rooms,
  runCatalogBatch,
  user,
  verification,
  workspaceModels,
} from "@groxbot/db";
import { and, count, desc, eq, inArray, like, ne, notLike, or, sql } from "drizzle-orm";

export interface AdminListOptions {
  limit: number;
  offset: number;
  search?: string;
}

function searchPattern(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  return `%${trimmed.replace(/[%_\\]/g, "\\$&")}%`;
}

/** RFC 2606 test mailbox. Live tests seed these; hide them from the operator list. */
export const ADMIN_HIDDEN_EMAIL_DOMAIN = "example.com";

export function isAdminHiddenEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${ADMIN_HIDDEN_EMAIL_DOMAIN}`);
}

function notHiddenTestEmail() {
  return notLike(user.email, `%@${ADMIN_HIDDEN_EMAIL_DOMAIN}`);
}

export async function adminStats(db: Database) {
  const [users] = await db
    .select({ count: count() })
    .from(user)
    .where(notHiddenTestEmail());
  const [workspaces] = await db.select({ count: count() }).from(organization);
  const [botRows] = await db.select({ count: count() }).from(bots);
  const [activeBots] = await db
    .select({ count: count() })
    .from(bots)
    .where(sql`${bots.archivedAt} is null`);

  return {
    userCount: users?.count ?? 0,
    workspaceCount: workspaces?.count ?? 0,
    botCount: botRows?.count ?? 0,
    activeBotCount: activeBots?.count ?? 0,
  };
}

export async function listAdminUsers(db: Database, options: AdminListOptions) {
  const pattern = searchPattern(options.search);
  const search = pattern
    ? or(like(user.email, pattern), like(user.name, pattern))
    : undefined;
  const where = and(notHiddenTestEmail(), search);

  const workspaceCount = sql<number>`(
    select count(*)
    from ${member}
    where ${member.userId} = ${user.id}
  )`.as("workspace_count");

  const [totalRow] = await db
    .select({ count: count() })
    .from(user)
    .where(where);

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      workspaceCount,
    })
    .from(user)
    .where(where)
    .orderBy(desc(user.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      emailVerified: row.emailVerified,
      workspaceCount: row.workspaceCount,
      createdAt: row.createdAt.toISOString(),
    })),
    total: totalRow?.count ?? 0,
    limit: options.limit,
    offset: options.offset,
  };
}

export async function listAdminWorkspaces(
  db: Database,
  options: AdminListOptions,
) {
  const pattern = searchPattern(options.search);
  const where = pattern
    ? or(
        like(organization.name, pattern),
        like(organization.slug, pattern),
      )
    : undefined;

  const memberCount = sql<number>`(
    select count(*)
    from ${member}
    where ${member.organizationId} = ${organization.id}
  )`.as("member_count");

  const botCount = sql<number>`(
    select count(*)
    from ${bots}
    where ${bots.workspaceId} = ${organization.id}
  )`.as("bot_count");

  const [totalRow] = await db
    .select({ count: count() })
    .from(organization)
    .where(where);

  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt,
      memberCount,
      botCount,
    })
    .from(organization)
    .where(where)
    .orderBy(desc(organization.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      memberCount: row.memberCount,
      botCount: row.botCount,
      createdAt: row.createdAt.toISOString(),
    })),
    total: totalRow?.count ?? 0,
    limit: options.limit,
    offset: options.offset,
  };
}

export class AdminDeleteError extends Error {
  readonly code: "NOT_FOUND" | "FORBIDDEN";

  constructor(code: "NOT_FOUND" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "AdminDeleteError";
    this.code = code;
  }
}

export async function deploymentOwnerUserId(
  db: Database,
): Promise<string | null> {
  const [row] = await db
    .select({ ownerUserId: deploymentSettings.ownerUserId })
    .from(deploymentSettings)
    .where(eq(deploymentSettings.id, "default"))
    .limit(1);
  return row?.ownerUserId ?? null;
}

export async function planAdminWorkspaceDelete(
  db: Database,
  workspaceId: string,
) {
  const [row] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, workspaceId))
    .limit(1);
  if (!row) throw new AdminDeleteError("NOT_FOUND", "Workspace not found.");
  return { workspaceId: row.id };
}

export async function planAdminUserDelete(db: Database, userId: string) {
  const ownerId = await deploymentOwnerUserId(db);
  if (ownerId && ownerId === userId) {
    throw new AdminDeleteError(
      "FORBIDDEN",
      "Cannot delete the deployment owner.",
    );
  }
  const [exists] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!exists) throw new AdminDeleteError("NOT_FOUND", "User not found.");

  const memberships = await db
    .select({ workspaceId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId));

  const soleWorkspaceIds: string[] = [];
  const shared: { workspaceId: string; reassignTo: string }[] = [];
  for (const row of memberships) {
    const [other] = await db
      .select({ userId: member.userId })
      .from(member)
      .where(
        and(
          eq(member.organizationId, row.workspaceId),
          ne(member.userId, userId),
        ),
      )
      .limit(1);
    if (other) shared.push({ workspaceId: row.workspaceId, reassignTo: other.userId });
    else soleWorkspaceIds.push(row.workspaceId);
  }

  const ownedBots = await db
    .select({
      id: bots.id,
      homeRoomId: bots.homeRoomId,
      workspaceId: bots.workspaceId,
    })
    .from(bots)
    .where(eq(bots.userId, userId));

  return { userId, soleWorkspaceIds, shared, ownedBots };
}

export async function commitAdminWorkspaceDelete(
  db: Database,
  workspaceId: string,
) {
  const removed = await db
    .delete(organization)
    .where(eq(organization.id, workspaceId))
    .returning();
  return removed.length > 0;
}

export async function commitAdminUserDelete(
  db: Database,
  userId: string,
  shared: { workspaceId: string; reassignTo: string }[],
  soleWorkspaceIds: string[],
) {
  const leftoverBots = await db
    .select({ id: bots.id, homeRoomId: bots.homeRoomId })
    .from(bots)
    .where(eq(bots.userId, userId));
  const leftoverBotIds = leftoverBots.map((bot) => bot.id);
  const now = new Date();
  const statements: unknown[] = [];
  for (const workspaceId of soleWorkspaceIds) {
    statements.push(db.delete(organization).where(eq(organization.id, workspaceId)));
  }
  for (const item of shared) {
    statements.push(
      db
        .update(rooms)
        .set({ createdByUserId: item.reassignTo, updatedAt: now })
        .where(
          and(
            eq(rooms.workspaceId, item.workspaceId),
            eq(rooms.createdByUserId, userId),
          ),
        ),
    );
    statements.push(
      db
        .update(workspaceModels)
        .set({ updatedBy: item.reassignTo, updatedAt: now })
        .where(
          and(
            eq(workspaceModels.workspaceId, item.workspaceId),
            eq(workspaceModels.updatedBy, userId),
          ),
        ),
    );
  }
  statements.push(
    db.delete(pluginConnections).where(eq(pluginConnections.userId, userId)),
  );
  statements.push(db.delete(mcpConnections).where(eq(mcpConnections.userId, userId)));
  statements.push(
    db.delete(knowledgeShares).where(eq(knowledgeShares.createdByUserId, userId)),
  );
  if (leftoverBotIds.length > 0) {
    statements.push(
      db
        .update(bots)
        .set({ parentBotId: null, updatedAt: now })
        .where(inArray(bots.parentBotId, leftoverBotIds)),
    );
  }
  statements.push(
    db
      .update(bots)
      .set({
        homeThreadId: null,
        homeRoomId: null,
        updatedAt: now,
      })
      .where(eq(bots.userId, userId)),
  );
  statements.push(db.delete(bots).where(eq(bots.userId, userId)));
  for (const bot of leftoverBots) {
    if (bot.homeRoomId) {
      statements.push(db.delete(rooms).where(eq(rooms.id, bot.homeRoomId)));
    }
  }
  statements.push(db.delete(user).where(eq(user.id, userId)));
  await runCatalogBatch(db, statements);
}

/** Wipes every workspace and user. Catalog tables (billing plans, pricing) stay. */
export async function purgeDeploymentData(db: Database) {
  const [workspaceRow] = await db.select({ count: count() }).from(organization);
  const [userRow] = await db.select({ count: count() }).from(user);
  await runCatalogBatch(db, [
    db.delete(organization),
    db.delete(verification),
    db.delete(user),
    db
      .update(deploymentSettings)
      .set({ ownerUserId: null, updatedAt: new Date() })
      .where(eq(deploymentSettings.id, "default")),
  ]);
  return {
    deletedWorkspaces: workspaceRow?.count ?? 0,
    deletedUsers: userRow?.count ?? 0,
  };
}
