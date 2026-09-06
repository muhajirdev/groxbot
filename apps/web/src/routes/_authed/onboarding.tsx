import { createFileRoute, redirect } from "@tanstack/react-router";
import type { Workspace } from "@groxbot/contracts";
import { OFFICE_TO, officeParams } from "../../lib/office-route";
import { workspaceListQueryOptions } from "../../lib/office-persist";
import { orpc } from "../../lib/orpc";
import { firstLiveBot, loadBotsForRoute } from "../../lib/session";
import {
  readCachedWorkspace,
  resolveWorkspaceForRoute,
  workspaceFromCache,
} from "../../lib/workspace-switcher";
import { Onboarding } from "../../screens/Onboarding";

type OnboardingSearch = {
  invite?: string;
};

export const Route = createFileRoute("/_authed/onboarding")({
  validateSearch: (search: Record<string, unknown> | undefined): OnboardingSearch => {
    const raw = search ?? {};
    return {
      invite: typeof raw.invite === "string" ? raw.invite : undefined,
    };
  },
  loader: async ({ context, search }) => {
    const me = await context.queryClient.ensureQueryData(
      orpc.me.queryOptions(),
    );
    if (me.needsWorkspace || search?.invite) return;
    const bots = await loadBotsForRoute();
    const first = firstLiveBot(bots);
    if (!first || !me.workspaceSlug) return;
    const listed = context.queryClient.getQueryData<Workspace[]>(
      workspaceListQueryOptions().queryKey,
    );
    const office = await resolveWorkspaceForRoute({
      slug: me.workspaceSlug,
      listed,
      hinted: workspaceFromCache(readCachedWorkspace(), me.workspaceSlug),
      fetchList: () =>
        context.queryClient.fetchQuery({
          ...workspaceListQueryOptions(),
          staleTime: 0,
        }),
    });
    if (!office) return;
    throw redirect({
      to: OFFICE_TO,
      params: officeParams(me.workspaceSlug, first.homeRoomId || first.id),
    });
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  const { invite } = Route.useSearch();
  return <Onboarding invite={invite} />;
}
