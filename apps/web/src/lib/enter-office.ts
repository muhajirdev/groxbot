import { isRedirect, redirect } from "@tanstack/react-router";
import { userFacingError } from "./errors";
import {
  clearRememberedInvite,
  readRememberedInvite,
} from "./invite";
import { OFFICE_TO, WORKSPACE_TO, officeParams } from "./office-route";
import { orpc, queryClient } from "./orpc";
import { client } from "./rpc";
import { setRpcWorkspaceId } from "./rpc-workspace";
import { defaultWorkspaceName } from "./onboarding";
import { firstLiveBot, loadBotsForRoute } from "./session";
import {
  patchMeWorkspace,
  rememberListedWorkspace,
} from "./workspace-catalog";
import { writeCachedWorkspace } from "./workspace-switcher";

export async function ensureActiveWorkspace(opts?: {
  invite?: string;
}): Promise<{ id: string; name: string; slug: string }> {
  const me = await queryClient.ensureQueryData(orpc.me.queryOptions());
  const invite = opts?.invite?.trim() || readRememberedInvite();
  if (invite) {
    try {
      const joined = await client.workspaces.join({ invitationId: invite });
      clearRememberedInvite();
      rememberListedWorkspace(joined);
      writeCachedWorkspace(joined);
      setRpcWorkspaceId(joined.id);
      patchMeWorkspace(joined);
      await queryClient.fetchQuery(orpc.me.queryOptions());
      return joined;
    } catch (caught) {
      if (me.workspaceId && me.workspaceSlug && me.workspaceName) {
        clearRememberedInvite();
        return {
          id: me.workspaceId,
          name: me.workspaceName,
          slug: me.workspaceSlug,
        };
      }
      throw caught;
    }
  }
  if (
    !me.needsWorkspace &&
    me.workspaceId &&
    me.workspaceSlug &&
    me.workspaceName
  ) {
    return {
      id: me.workspaceId,
      name: me.workspaceName,
      slug: me.workspaceSlug,
    };
  }
  const created = await client.workspaces.create({
    name: defaultWorkspaceName(me),
  });
  rememberListedWorkspace(created);
  writeCachedWorkspace(created);
  setRpcWorkspaceId(created.id);
  patchMeWorkspace(created);
  await queryClient.fetchQuery(orpc.me.queryOptions());
  return created;
}

function officeRedirect(workspaceSlug: string, roomId?: string) {
  if (!roomId) {
    return redirect({
      to: WORKSPACE_TO,
      params: { workspaceSlug },
    });
  }
  return redirect({
    to: OFFICE_TO,
    params: officeParams(workspaceSlug, roomId),
  });
}

/** Open the office. Create a workspace if this account has none. */
export async function redirectAuthedHome(): Promise<never> {
  const invite = readRememberedInvite();
  try {
    const workspace = await ensureActiveWorkspace({ invite });
    const bots = await loadBotsForRoute();
    const first = firstLiveBot(bots);
    throw officeRedirect(
      workspace.slug,
      first ? first.homeRoomId || first.id : undefined,
    );
  } catch (caught) {
    if (isRedirect(caught)) throw caught;
    throw redirect({
      to: "/onboarding",
      search: invite ? { invite } : {},
    });
  }
}

export function officeOpenError(caught: unknown): string {
  return userFacingError(caught, "Could not open the office");
}
