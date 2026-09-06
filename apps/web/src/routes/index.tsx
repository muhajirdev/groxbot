import { createFileRoute, redirect } from "@tanstack/react-router";
import { redirectAuthedHome } from "../lib/enter-office";
import { rememberInvite } from "../lib/invite";
import { orpc } from "../lib/orpc";
import { AuthScreen } from "../screens/AuthScreen";
import { InviteScreen } from "../screens/InviteScreen";

type HomeSearch = {
  error?: string;
  invite?: string;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown> | undefined): HomeSearch => {
    const raw = search ?? {};
    return {
      error: typeof raw.error === "string" ? raw.error : undefined,
      invite: typeof raw.invite === "string" ? raw.invite : undefined,
    };
  },
  beforeLoad: async ({ context, search }) => {
    rememberInvite(search?.invite);
    const hash =
      typeof window === "undefined"
        ? ""
        : window.location.hash.replace(/^#/, "");
    if (hash && context.session) {
      const me = await context.queryClient.ensureQueryData(
        orpc.me.queryOptions(),
      );
      if (me.workspaceSlug) {
        throw redirect({
          to: "/$workspaceSlug/bot/$botId",
          params: { workspaceSlug: me.workspaceSlug, botId: hash },
        });
      }
    }
    if (search?.invite) return;
    if (context.session) await redirectAuthedHome();
  },
  component: HomePage,
});

function HomePage() {
  const { error, invite } = Route.useSearch();
  const { session } = Route.useRouteContext();
  if (invite) {
    return (
      <InviteScreen
        invite={invite}
        signedIn={Boolean(session)}
        errorFromUrl={error}
      />
    );
  }
  return <AuthScreen errorFromUrl={error} />;
}
