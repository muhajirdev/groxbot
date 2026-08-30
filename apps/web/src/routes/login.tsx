import { createFileRoute, redirect } from "@tanstack/react-router";
import { rememberInvite } from "../lib/invite";
import { redirectAuthedHome } from "../lib/session";
import { AuthScreen } from "../screens/AuthScreen";

type LoginSearch = {
  error?: string;
  invite?: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    error: typeof search.error === "string" ? search.error : undefined,
    invite: typeof search.invite === "string" ? search.invite : undefined,
  }),
  beforeLoad: async ({ context, search }) => {
    rememberInvite(search.invite);
    if (!context.session) return;
    if (search.invite) {
      throw redirect({
        to: "/onboarding",
        search: { invite: search.invite },
      });
    }
    await redirectAuthedHome();
  },
  component: LoginPage,
});

function LoginPage() {
  const { error, invite } = Route.useSearch();
  return <AuthScreen errorFromUrl={error} invite={invite} />;
}
