import {
  invitationIdFromInput,
  invitationUrl,
  listPendingInvitations,
  peekInvitation,
  renameWorkspace,
  slugForWorkspace,
  workspaceAuthMessage,
} from "@groxbot/core";
import { ORPCError } from "@orpc/server";
import type { RpcContext } from "./context.js";
import { requireActor, type SessionUser } from "./session.js";

function toWorkspace(org: { id: string; name: string; slug?: string | null }) {
  return { id: org.id, name: org.name, slug: org.slug || org.id };
}

export async function createWorkspace(
  context: RpcContext,
  user: SessionUser,
  name: string,
) {
  if (!context.auth) {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in" });
  }
  const trimmed = name.trim();
  const slug = slugForWorkspace(trimmed, user.userId);
  let created: { id: string; name: string; slug?: string | null } | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const org = await context.auth.api.createOrganization({
        body: {
          name: trimmed,
          slug: attempt === 0 ? slug : `${slug}-${attempt + 1}`,
        },
        headers: user.headers,
      });
      if (!org?.id) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Could not create workspace",
        });
      }
      created = org;
      break;
    } catch (caught) {
      const message = authMessage(caught);
      if (attempt < 3 && /already exists|slug already taken/i.test(message)) {
        continue;
      }
      throwWorkspaceError(caught, "Could not create workspace");
    }
  }
  if (!created) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Pick another workspace name.",
    });
  }
  try {
    await context.auth.api.setActiveOrganization({
      body: { organizationId: created.id },
      headers: user.headers,
    });
  } catch (caught) {
    throwWorkspaceError(caught, "Could not create workspace");
  }
  return toWorkspace(created);
}

export async function listWorkspaces(context: RpcContext, user: SessionUser) {
  if (!context.auth) {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in" });
  }
  const orgs = await context.auth.api.listOrganizations({
    headers: user.headers,
  });
  return (orgs ?? []).map((org) => toWorkspace(org));
}

export async function activateWorkspace(
  context: RpcContext,
  user: SessionUser,
  workspaceId: string,
) {
  if (!context.auth) {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in" });
  }
  try {
    const org = await context.auth.api.setActiveOrganization({
      body: { organizationId: workspaceId },
      headers: user.headers,
    });
    if (!org?.id) {
      throw new ORPCError("BAD_REQUEST", {
        message: "That workspace is missing.",
      });
    }
    return toWorkspace(org);
  } catch (caught) {
    if (caught instanceof ORPCError) throw caught;
    throwWorkspaceError(caught, "Could not switch workspace");
  }
}

export async function updateWorkspace(context: RpcContext, name: string) {
  const actor = await requireActor(context);
  const org = await renameWorkspace(context.db, actor.workspaceId, name);
  if (!org) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Pick another workspace name.",
    });
  }
  return org;
}

export async function joinWorkspace(
  context: RpcContext,
  user: SessionUser,
  rawInvitationId: string,
) {
  if (!context.auth) {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in" });
  }
  const invitationId = invitationIdFromInput(rawInvitationId);
  if (!invitationId) {
    throw new ORPCError("BAD_REQUEST", { message: "Paste an invite to join." });
  }
  return joinWithHeaders(context, user.headers, invitationId);
}

export async function inviteToWorkspace(context: RpcContext, email: string) {
  const actor = await requireActor(context);
  if (!context.auth) {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in" });
  }
  try {
    const invitation = await context.auth.api.createInvitation({
      body: {
        email: email.trim().toLowerCase(),
        role: "member",
        organizationId: actor.workspaceId,
      },
      headers: context.headers ?? new Headers(),
    });
    if (!invitation?.id) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Could not send invite",
      });
    }
    return {
      id: invitation.id,
      email: invitation.email,
      url: invitationUrl(context.env.webOrigin, invitation.id),
    };
  } catch (caught) {
    if (caught instanceof ORPCError) throw caught;
    throwWorkspaceError(caught, "Could not send invite");
  }
}

export async function pendingInvitations(context: RpcContext, email: string) {
  return listPendingInvitations(context.db, email);
}

export async function peekWorkspaceInvite(
  context: RpcContext,
  invitationId: string,
) {
  return peekInvitation(context.db, invitationId);
}

export async function acceptInviteFromLink(
  context: RpcContext,
  request: Request,
  rawInvitationId: string,
): Promise<{
  workspace: { id: string; name: string; slug: string };
  cookies: string[];
}> {
  if (!context.auth) {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in" });
  }
  const invitationId = invitationIdFromInput(rawInvitationId);
  if (!invitationId) {
    throw new ORPCError("BAD_REQUEST", { message: "Paste an invite to join." });
  }
  const peek = await peekInvitation(context.db, invitationId);
  if (!peek) {
    throw new ORPCError("BAD_REQUEST", {
      message: "That invite is missing or expired.",
    });
  }

  const headers = new Headers(request.headers);
  if (!headers.get("origin")) {
    headers.set("origin", context.env.webOrigin);
  }
  const session = await context.auth.api.getSession({ headers });
  let cookies: string[] = [];
  let joinHeaders = headers;

  if (session) {
    if (
      session.user.email.trim().toLowerCase() !==
      peek.email.trim().toLowerCase()
    ) {
      throw new ORPCError("BAD_REQUEST", {
        message: "That invite is for a different email.",
      });
    }
  } else {
    const signedIn = await signInAsInvitedEmail(context, headers, peek.email);
    cookies = signedIn.cookies;
    joinHeaders = signedIn.headers;
  }

  const workspace = await joinWithHeaders(context, joinHeaders, invitationId);
  return { workspace, cookies };
}

async function signInAsInvitedEmail(
  context: RpcContext,
  requestHeaders: Headers,
  email: string,
) {
  const auth = context.auth;
  if (!auth) {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in" });
  }
  const token = randomToken();
  const authCtx = await auth.$context;
  await authCtx.internalAdapter.createVerificationValue({
    identifier: token,
    value: JSON.stringify({
      email,
      name: email.split("@")[0] || email,
    }),
    expiresAt: new Date(Date.now() + 60_000),
  });
  const verify = await auth.api.magicLinkVerify({
    query: { token },
    headers: requestHeaders,
    asResponse: true,
  });
  if (!(verify instanceof Response) || !verify.ok) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Could not join workspace",
    });
  }
  const cookies = verify.headers.getSetCookie();
  const next = new Headers(requestHeaders);
  const pairs = cookies
    .map((line) => line.split(";", 1)[0]?.trim())
    .filter((pair): pair is string => Boolean(pair));
  const existing = next.get("cookie");
  next.set("cookie", [existing, ...pairs].filter(Boolean).join("; "));
  return { cookies, headers: next };
}

function randomToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

async function joinWithHeaders(
  context: RpcContext,
  headers: Headers,
  invitationId: string,
) {
  const auth = context.auth;
  if (!auth) {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in" });
  }
  try {
    const accepted = await auth.api.acceptInvitation({
      body: { invitationId },
      headers,
    });
    const organizationId = accepted?.invitation?.organizationId;
    if (!organizationId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "That invite is missing or expired.",
      });
    }
    await auth.api.setActiveOrganization({
      body: { organizationId },
      headers,
    });
    const org = await auth.api.getFullOrganization({
      query: { organizationId },
      headers,
    });
    return {
      id: organizationId,
      name: org?.name ?? "Workspace",
      slug: org?.slug ?? organizationId,
    };
  } catch (caught) {
    if (caught instanceof ORPCError) throw caught;
    throwWorkspaceError(caught, "Could not join workspace");
  }
}

export function throwWorkspaceError(caught: unknown, fallback: string): never {
  throw new ORPCError("BAD_REQUEST", {
    message: workspaceAuthMessage(authMessage(caught), fallback),
  });
}

function authMessage(caught: unknown): string {
  if (caught instanceof Error && caught.message.trim()) return caught.message;
  if (caught && typeof caught === "object" && "message" in caught) {
    return String((caught as { message?: unknown }).message ?? "");
  }
  return "";
}
