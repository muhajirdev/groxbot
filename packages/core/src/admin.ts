import {
  type Database,
  bots,
  deploymentSettings,
  member,
  organization,
  user,
  verification,
} from "@groxbot/db";
import { count, desc, eq, ilike, or, sql } from "drizzle-orm";

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

export async function adminStats(db: Database) {
  const [users] = await db.select({ count: count() }).from(user);
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
  const where = pattern
    ? or(ilike(user.email, pattern), ilike(user.name, pattern))
    : undefined;

  const workspaceCount = sql<number>`(
    select count(*)::int
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
        ilike(organization.name, pattern),
        ilike(organization.slug, pattern),
      )
    : undefined;

  const memberCount = sql<number>`(
    select count(*)::int
    from ${member}
    where ${member.organizationId} = ${organization.id}
  )`.as("member_count");

  const botCount = sql<number>`(
    select count(*)::int
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

/** Wipes every workspace and user. Catalog tables (billing plans, pricing) stay. */
export async function purgeDeploymentData(db: Database) {
  return db.transaction(async (tx) => {
    const [workspaceRow] = await tx
      .select({ count: count() })
      .from(organization);
    const [userRow] = await tx.select({ count: count() }).from(user);

    await tx.delete(organization);
    await tx.delete(verification);
    await tx.delete(user);
    await tx
      .update(deploymentSettings)
      .set({ ownerUserId: null, updatedAt: new Date() })
      .where(eq(deploymentSettings.id, "default"));

    return {
      deletedWorkspaces: workspaceRow?.count ?? 0,
      deletedUsers: userRow?.count ?? 0,
    };
  });
}
