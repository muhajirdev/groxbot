import { WORKSPACE_ID_HEADER } from "@groxbot/contracts";
import { isWorkspaceMember, publishedProfileImage } from "@groxbot/core";
import { bots, deploymentSettings, organization, user } from "@groxbot/db";
import { ORPCError } from "@orpc/server";
import { eq, or } from "drizzle-orm";
import type { RpcContext } from "./context.js";

export interface Actor {
  userId: string;
  email: string;
  name: string;
  image: string | null;
  workspaceId: string;
  isDeploymentOwner: boolean;
}

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  image: string | null;
  /** Last-used workspace from Better Auth `activeOrganizationId`. */
  workspaceId: string | null;
  workspaceName: string | null;
  headers: Headers;
  isDeploymentOwner: boolean;
}

export function requestedWorkspaceId(headers: Headers): string | null {
  const id = headers.get(WORKSPACE_ID_HEADER)?.trim() ?? "";
  return id || null;
}

/** Session + active workspace. Skips org listing and owner when the session already has one. */
export async function requireUser(context: RpcContext): Promise<SessionUser> {
  if (!context.auth) {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in" });
  }
  const headers = context.headers ?? new Headers();
  const session = await context.auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });
  if (!session) {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in" });
  }

  let workspaceId = session.session.activeOrganizationId ?? null;
  let workspaceName: string | null = null;
  if (!workspaceId) {
    const orgs = await context.auth.api.listOrganizations({ headers });
    workspaceId = orgs[0]?.id ?? null;
    workspaceName = orgs[0]?.name ?? null;
    if (workspaceId) {
      await context.auth.api.setActiveOrganization({
        body: { organizationId: workspaceId },
        headers,
      });
    }
  }

  let name = session.user.name;
  let image: string | null = session.user.image ?? null;
  try {
    const [profile] = await context.db
      .select({
        name: user.name,
        image: user.image,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);
    name = profile?.name || name;
    image = publishedProfileImage(
      profile?.image ?? session.user.image,
      session.user.id,
      profile?.updatedAt?.getTime() ?? 0,
      context.env?.apiUrl ?? context.env?.authUrl ?? "",
    );
  } catch {
    // Session-only contexts (unit tests) skip the profile join.
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    name,
    image,
    workspaceId,
    workspaceName,
    headers,
    isDeploymentOwner: false,
  };
}

function missingWorkspace(): never {
  throw new ORPCError("FAILED_PRECONDITION", {
    message: "Create or join a workspace",
  });
}

function unknownWorkspace(): never {
  throw new ORPCError("NOT_FOUND", {
    message: "That workspace is missing.",
  });
}

async function assertWorkspaceMember(
  context: RpcContext,
  user: SessionUser,
  workspaceId: string,
): Promise<void> {
  try {
    if (await isWorkspaceMember(context.db, user.userId, workspaceId)) return;
  } catch {
    // Session-only unit tests have no database.
  }
  if (!context.auth) unknownWorkspace();
  const orgs = await context.auth.api.listOrganizations({
    headers: user.headers,
  });
  if (!orgs.some((org) => org.id === workspaceId)) unknownWorkspace();
}

export async function requireActor(context: RpcContext): Promise<Actor> {
  const user = await requireUser(context);
  const requested = requestedWorkspaceId(user.headers);
  const workspaceId = requested ?? user.workspaceId;
  if (!workspaceId) missingWorkspace();
  if (requested && requested !== user.workspaceId) {
    await assertWorkspaceMember(context, user, requested);
  }
  return {
    userId: user.userId,
    email: user.email,
    name: user.name,
    image: user.image,
    workspaceId,
    isDeploymentOwner: user.isDeploymentOwner,
  };
}

/** Actor handshake: the bot row is the tenant, not the session's last-used org. */
export async function actorForAgentBot(
  context: RpcContext,
  botId: string,
): Promise<Actor | null> {
  const user = await requireUser(context);
  let workspaceId: string | null = null;
  try {
    const [bot] = await context.db
      .select({ workspaceId: bots.workspaceId })
      .from(bots)
      .where(or(eq(bots.id, botId), eq(bots.homeRoomId, botId)))
      .limit(1);
    workspaceId = bot?.workspaceId ?? null;
  } catch {
    return null;
  }
  if (!workspaceId) return null;
  await assertWorkspaceMember(context, user, workspaceId);
  return {
    userId: user.userId,
    email: user.email,
    name: user.name,
    image: user.image,
    workspaceId,
    isDeploymentOwner: user.isDeploymentOwner,
  };
}

export async function loadWorkspaceRef(
  context: RpcContext,
  user: SessionUser,
): Promise<{ name: string | null; slug: string | null }> {
  if (!user.workspaceId) return { name: null, slug: null };
  try {
    const [row] = await context.db
      .select({
        name: organization.name,
        slug: organization.slug,
      })
      .from(organization)
      .where(eq(organization.id, user.workspaceId))
      .limit(1);
    if (row) {
      return { name: row.name, slug: row.slug || user.workspaceId };
    }
  } catch {
    // Session-only contexts skip the org join.
  }
  if (user.workspaceName) {
    return { name: user.workspaceName, slug: user.workspaceId };
  }
  if (!context.auth) return { name: null, slug: user.workspaceId };
  const orgs = await context.auth.api.listOrganizations({
    headers: user.headers,
  });
  const org =
    orgs.find((item) => item.id === user.workspaceId) ?? orgs[0] ?? null;
  return {
    name: org?.name ?? null,
    slug: org?.slug || user.workspaceId,
  };
}

export async function loadWorkspaceName(
  context: RpcContext,
  user: SessionUser,
): Promise<string | null> {
  const ref = await loadWorkspaceRef(context, user);
  return ref.name;
}

export async function ensureDeploymentOwner(
  context: RpcContext,
  userId: string,
): Promise<boolean> {
  const [settings] = await context.db
    .select()
    .from(deploymentSettings)
    .where(eq(deploymentSettings.id, "default"))
    .limit(1);
  let ownerUserId = settings?.ownerUserId ?? null;
  if (!settings) {
    await context.db.insert(deploymentSettings).values({
      id: "default",
      ownerUserId: userId,
    });
    ownerUserId = userId;
  } else if (!ownerUserId) {
    await context.db
      .update(deploymentSettings)
      .set({ ownerUserId: userId, updatedAt: new Date() })
      .where(eq(deploymentSettings.id, "default"));
    ownerUserId = userId;
  }
  return ownerUserId === userId;
}

export async function requireDeploymentOwner(
  context: RpcContext,
): Promise<SessionUser> {
  const user = await requireUser(context);
  const isOwner = await ensureDeploymentOwner(context, user.userId);
  if (!isOwner) {
    throw new ORPCError("FORBIDDEN", {
      message: "Deployment owner access required.",
    });
  }
  return { ...user, isDeploymentOwner: true };
}
