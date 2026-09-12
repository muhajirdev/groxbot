import type { Me } from "@groxbot/contracts";
import { clearOfficeMessages } from "./office-cache";
import { orpc, queryClient } from "./orpc";
import { rpcWorkspaceId, setRpcWorkspaceId } from "./rpc-workspace";

/** Tenant-scope a catalog key so Office cannot keep another workspace’s list. */
export function officeQueryKey(
  key: readonly unknown[],
  workspaceId: string | null | undefined = rpcWorkspaceId(),
) {
  return [...key, workspaceId ?? ""] as const;
}

export function patchMeWorkspace(workspace: {
  id: string;
  name?: string;
  slug?: string;
}): void {
  queryClient.setQueryData(
    orpc.me.queryOptions().queryKey,
    (prev: Me | undefined): Me | undefined => {
      if (!prev) return prev;
      const sameOffice = prev.workspaceId === workspace.id;
      return {
        ...prev,
        workspaceId: workspace.id,
        workspaceName: workspace.name ?? prev.workspaceName,
        workspaceSlug: workspace.slug ?? prev.workspaceSlug,
        needsWorkspace: false,
        trialAvailable: sameOffice ? prev.trialAvailable : true,
        needsHostedPlan: sameOffice ? prev.needsHostedPlan : true,
      };
    },
  );
}

const OFFICE_QUERY_KEYS = [
  orpc.bots.key(),
  orpc.rooms.key(),
  orpc.sections.key(),
  orpc.knowledge.key(),
  orpc.models.key(),
  orpc.billing.key(),
  orpc.apps.key(),
  orpc.plugins.key(),
  orpc.mcp.key(),
] as const;

/** Stamp RPC, drop the old office transcript, refetch catalogs for this tenant. */
export async function refreshOfficeAfterWorkspaceChange(workspace: {
  id: string;
  name?: string;
  slug?: string;
}): Promise<void> {
  setRpcWorkspaceId(workspace.id);
  patchMeWorkspace(workspace);
  clearOfficeMessages();
  await Promise.all([
    ...OFFICE_QUERY_KEYS.map((queryKey) =>
      queryClient.resetQueries({ queryKey }),
    ),
    queryClient.invalidateQueries({ queryKey: orpc.me.key() }),
    queryClient.refetchQueries({ queryKey: orpc.bots.list.key() }),
    queryClient.refetchQueries({ queryKey: orpc.rooms.list.key() }),
    queryClient.refetchQueries({ queryKey: orpc.sections.list.key() }),
  ]);
}
