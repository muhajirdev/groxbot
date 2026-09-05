import type { Workspace } from "@groxbot/contracts";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { workspaceListQueryOptions } from "../../../lib/office-persist";
import { setRpcWorkspaceId } from "../../../lib/rpc-workspace";
import { adoptWorkspaceCatalog } from "../../../lib/workspace-catalog";
import {
  readCachedWorkspace,
  workspaceFromCache,
  workspaceFromList,
} from "../../../lib/workspace-switcher";

export const Route = createFileRoute("/_authed/$workspaceSlug")({
  beforeLoad: async ({ context, params }) => {
    const hinted = workspaceFromCache(
      readCachedWorkspace(),
      params.workspaceSlug,
    );
    if (hinted) setRpcWorkspaceId(hinted.id);

    const listed = context.queryClient.getQueryData<Workspace[]>(
      workspaceListQueryOptions().queryKey,
    );
    const fromCache = listed
      ? workspaceFromList(listed, params.workspaceSlug)
      : undefined;
    if (fromCache) {
      setRpcWorkspaceId(fromCache.id);
      adoptWorkspaceCatalog(fromCache.id);
      void context.queryClient.ensureQueryData(workspaceListQueryOptions());
      return { workspace: fromCache };
    }

    const workspaces = await context.queryClient.ensureQueryData(
      workspaceListQueryOptions(),
    );
    const workspace = workspaceFromList(workspaces, params.workspaceSlug);
    if (!workspace) {
      setRpcWorkspaceId(null);
      throw redirect({ to: "/onboarding", search: {} });
    }
    setRpcWorkspaceId(workspace.id);
    adoptWorkspaceCatalog(workspace.id);
    return { workspace };
  },
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  return <Outlet />;
}
