import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { orpc } from "../../../lib/orpc";
import { setRpcWorkspaceId } from "../../../lib/rpc-workspace";

export const Route = createFileRoute("/_authed/$workspaceSlug")({
  beforeLoad: async ({ context, params }) => {
    const workspaces = await context.queryClient.ensureQueryData(
      orpc.workspaces.list.queryOptions(),
    );
    const workspace =
      workspaces.find((item) => item.slug === params.workspaceSlug) ??
      workspaces.find((item) => item.id === params.workspaceSlug);
    if (!workspace) {
      setRpcWorkspaceId(null);
      throw redirect({ to: "/onboarding", search: {} });
    }
    setRpcWorkspaceId(workspace.id);
    return { workspace };
  },
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  return <Outlet />;
}
