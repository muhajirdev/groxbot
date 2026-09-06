import { createFileRoute, redirect } from "@tanstack/react-router";
import { redirectAuthedHome } from "../lib/enter-office";
import { rememberInvite } from "../lib/invite";

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
    if (context.session) await redirectAuthedHome();
    throw redirect({
      to: "/",
      search: {
        ...(search?.error ? { error: search.error } : {}),
        ...(search?.invite ? { invite: search.invite } : {}),
      },
    });
  },
  component: () => null,
});
