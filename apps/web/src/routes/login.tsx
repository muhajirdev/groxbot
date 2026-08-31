import { createFileRoute, redirect } from "@tanstack/react-router";
import { readRememberedInvite, rememberInvite } from "../lib/invite";
import { redirectAuthedHome } from "../lib/session";
import { AuthScreen } from "../screens/AuthScreen";

type LoginSearch = {
  error?: string;
  invite?: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown> | undefined): LoginSearch => {
    const raw = search ?? {};
    return {
      error: typeof raw.error === "string" ? raw.error : undefined,
      invite: typeof raw.invite === "string" ? raw.invite : undefined,
    };
  },
  beforeLoad: async ({ context, search }) => {
    rememberInvite(search?.invite);
    const invite = search?.invite?.trim() || readRememberedInvite();
    if (!context.session) return;
    if (invite) {
      throw redirect({
        to: "/onboarding",
        search: { invite },
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
