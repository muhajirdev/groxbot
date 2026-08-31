import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { inviteFromHref, rememberInvite } from "../../lib/invite";

export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context, location }) => {
    const invite = inviteFromHref(location.href);
    rememberInvite(invite);
    if (context.session) return;
    throw redirect({
      to: "/login",
      search: invite ? { invite } : {},
    });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return <Outlet />;
}
