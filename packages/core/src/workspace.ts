import { type Database, invitation, member, organization, user } from "@groxbot/db";
import { and, eq, gt, sql } from "drizzle-orm";

const SLUG_NAME_MAX = 24;

/** URL-safe workspace slug: `{name}-{salt}`. */
export function slugForWorkspace(name: string, salt: string): string {
  const base =
    name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, SLUG_NAME_MAX) || "workspace";
  const tail =
    salt
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8) || "office";
  return `${base}-${tail}`;
}

/** Accept a raw invite id or an onboarding URL that carries `?invite=`. */
export function invitationIdFromInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const invite = url.searchParams.get("invite")?.trim();
    if (invite) return invite;
  } catch {
    // Not a URL — fall through.
  }
  const match = trimmed.match(/[?&]invite=([^&]+)/);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]).trim();
    } catch {
      return match[1].trim();
    }
  }
  return trimmed;
}

export function invitationUrl(webOrigin: string, invitationId: string): string {
  const origin = webOrigin.replace(/\/$/, "");
  return `${origin}/onboarding?invite=${encodeURIComponent(invitationId)}`;
}

export async function renameWorkspace(
  db: Database,
  workspaceId: string,
  name: string,
) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const [row] = await db
    .update(organization)
    .set({ name: trimmed })
    .where(eq(organization.id, workspaceId))
    .returning();
  return row
    ? { id: row.id, name: row.name, slug: row.slug }
    : null;
}

export function workspaceAuthMessage(raw: string, fallback: string): string {
  const text = raw.trim();
  if (!text) return fallback;
  if (/not the recipient/i.test(text)) {
    return "That invite is for a different email.";
  }
  if (/invitation not found|failed to retrieve invitation/i.test(text)) {
    return "That invite is missing or expired.";
  }
  if (/already invited/i.test(text)) {
    return "That person already has an invite.";
  }
  if (/already a member/i.test(text)) {
    return "They're already in this workspace.";
  }
  if (/slug already taken|organization already exists/i.test(text)) {
    return "Pick another workspace name.";
  }
  if (/not allowed to invite/i.test(text)) {
    return "You can't invite people to this workspace.";
  }
  if (/not allowed to (update|perform this action)/i.test(text)) {
    return "You can't rename this workspace.";
  }
  if (/email verification required/i.test(text)) {
    return "Verify your email, then join the workspace.";
  }
  return text;
}

export async function listPendingInvitations(db: Database, email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];
  const rows = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      organizationId: invitation.organizationId,
      organizationName: organization.name,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(
      and(
        sql`lower(${invitation.email}) = ${normalized}`,
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, new Date()),
      ),
    );
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role ?? "member",
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    expiresAt: row.expiresAt.toISOString(),
  }));
}

/** Public lookup by invite id. The id is the secret; missing/expired returns null. */
export async function peekInvitation(db: Database, raw: string) {
  const invitationId = invitationIdFromInput(raw);
  if (!invitationId) return null;
  const rows = await db
    .select({
      email: invitation.email,
      organizationId: invitation.organizationId,
      organizationName: organization.name,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(eq(invitation.id, invitationId))
    .limit(1);
  const row = rows[0];
  if (!row?.status || row.status !== "pending" || row.expiresAt <= new Date()) {
    return null;
  }
  return {
    email: row.email,
    organizationName: row.organizationName,
    organizationId: row.organizationId,
  };
}

export async function listWorkspaceMembers(
  db: Database,
  workspaceId: string,
  viewerUserId: string,
) {
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: member.role,
      updatedAt: user.updatedAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, workspaceId));
  const rank = (role: string) =>
    role === "owner" ? 0 : role === "admin" ? 1 : 2;
  return rows
    .map((row) => ({
      userId: row.userId,
      name: row.name,
      email: row.email,
      image: row.image,
      role: row.role,
      updatedAt: row.updatedAt,
      mine: row.userId === viewerUserId,
    }))
    .sort((a, b) => {
      const byRole = rank(a.role) - rank(b.role);
      if (byRole !== 0) return byRole;
      return a.name.localeCompare(b.name);
    });
}
