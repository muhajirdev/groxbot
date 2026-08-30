import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

function inviteFromHref(href: string): string | undefined {
  try {
    const invite = new URL(href).searchParams.get("invite")?.trim();
    return invite || undefined;
  } catch {
    return undefined;
  }
}

export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context, location }) => {
    if (context.session) return;
    const invite = inviteFromHref(location.href);
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
