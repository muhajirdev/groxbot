import { createFileRoute, redirect } from "@tanstack/react-router";
import { orpc } from "../../lib/orpc";
import { firstLiveBot, loadBotsForRoute } from "../../lib/session";
import { Onboarding } from "../../screens/Onboarding";

type OnboardingSearch = {
  invite?: string;
};

export const Route = createFileRoute("/_authed/onboarding")({
  validateSearch: (search: Record<string, unknown>): OnboardingSearch => ({
    invite: typeof search.invite === "string" ? search.invite : undefined,
  }),
  loader: async ({ context, search }) => {
    const me = await context.queryClient.ensureQueryData(
      orpc.me.queryOptions(),
    );
    if (me.needsWorkspace || search.invite) return;
    const bots = await loadBotsForRoute();
    const first = firstLiveBot(bots);
    if (first) {
      throw redirect({ to: "/$botId", params: { botId: first.id } });
    }
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  const { invite } = Route.useSearch();
  return <Onboarding invite={invite} />;
}
