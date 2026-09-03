import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { redirectAuthedHome } from "../lib/session";
import { Welcome } from "../screens/Welcome";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const hash =
      typeof window === "undefined"
        ? ""
        : window.location.hash.replace(/^#/, "");
    if (hash && context.session) {
      throw redirect({ to: "/bot/$botId", params: { botId: hash } });
    }
    if (context.session) await redirectAuthedHome();
  },
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <Welcome
      start={
        <Link to="/login" viewTransition className="btn lg">
          Get started
        </Link>
      }
    />
  );
}
