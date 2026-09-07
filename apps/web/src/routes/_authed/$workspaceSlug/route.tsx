import type { Workspace } from "@groxbot/contracts";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { workspaceListQueryOptions } from "../../../lib/office-persist";
import { orpc } from "../../../lib/orpc";
import { setRpcWorkspaceId } from "../../../lib/rpc-workspace";
import { adoptWorkspaceCatalog } from "../../../lib/workspace-catalog";
import {
  readCachedWorkspace,
  resolveWorkspaceForRoute,
  workspaceFromCache,
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
    const resolved = await resolveWorkspaceForRoute({
      slug: params.workspaceSlug,
      listed,
      hinted,
      fetchList: () =>
        context.queryClient.fetchQuery({
          ...workspaceListQueryOptions(),
          staleTime: 0,
        }),
    });
    if (!resolved) {
      setRpcWorkspaceId(null);
      throw redirect({ to: "/" });
    }
    if (resolved.needsListRefresh) {
      void context.queryClient.fetchQuery({
        ...workspaceListQueryOptions(),
        staleTime: 0,
      });
    } else {
      void context.queryClient.ensureQueryData(workspaceListQueryOptions());
    }
    setRpcWorkspaceId(resolved.workspace.id);
    adoptWorkspaceCatalog(resolved.workspace.id);
    // Boot starts `me` before this stamp. Refetch so Polar/plan is this office.
    void context.queryClient.invalidateQueries({ queryKey: orpc.me.key() });
    return { workspace: resolved.workspace };
  },
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  return <Outlet />;
}
