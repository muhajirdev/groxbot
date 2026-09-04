import { createFileRoute, redirect } from "@tanstack/react-router";
import { orpc } from "../../../lib/orpc";

/** Old `/bot/$botId` bookmarks follow the last-used office slug. */
export const Route = createFileRoute("/_authed/bot/$botId")({
  beforeLoad: async ({ context, params }) => {
    const me = await context.queryClient.ensureQueryData(
      orpc.me.queryOptions(),
    );
    if (me.needsWorkspace || !me.workspaceSlug) {
      throw redirect({ to: "/onboarding", search: {} });
    }
    throw redirect({
      to: "/$workspaceSlug/bot/$botId",
      params: { workspaceSlug: me.workspaceSlug, botId: params.botId },
    });
  },
});
