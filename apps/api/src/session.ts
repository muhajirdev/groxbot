import { publishedProfileImage } from "@groxbot/core";
import { deploymentSettings, user } from "@groxbot/db";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
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
  workspaceId: string | null;
  workspaceName: string | null;
  headers: Headers;
  isDeploymentOwner: boolean;
}

/** Session + active workspace. Skips org listing and owner when the session already has one. */
export async function requireUser(context: RpcContext): Promise<SessionUser> {
  if (!context.auth) {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in" });
  }
  const headers = context.headers ?? new Headers();
  const session = await context.auth.api.getSession({ headers });
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

export async function requireActor(context: RpcContext): Promise<Actor> {
  const user = await requireUser(context);
  if (!user.workspaceId) {
    throw new ORPCError("FAILED_PRECONDITION", {
      message: "Create or join a workspace",
    });
  }
  return {
    userId: user.userId,
    email: user.email,
    name: user.name,
    image: user.image,
    workspaceId: user.workspaceId,
    isDeploymentOwner: user.isDeploymentOwner,
  };
}

export async function loadWorkspaceName(
  context: RpcContext,
  user: SessionUser,
): Promise<string | null> {
  if (user.workspaceName) return user.workspaceName;
  if (!user.workspaceId || !context.auth) return null;
  const orgs = await context.auth.api.listOrganizations({
    headers: user.headers,
  });
  return (
    orgs.find((org) => org.id === user.workspaceId)?.name ??
    orgs[0]?.name ??
    null
  );
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
