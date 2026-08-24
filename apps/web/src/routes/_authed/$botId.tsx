import { createFileRoute, redirect } from "@tanstack/react-router";
import { botsCollection, peekBots } from "../../lib/collections";
import { firstLiveBot, loadBotsForRoute } from "../../lib/session";
import { Chat } from "../../screens/Chat";

export const Route = createFileRoute("/_authed/$botId")({
  pendingMs: 1000,
  preloadStaleTime: 30_000,
  loader: ({ params }) => {
    if (botsCollection.has(params.botId)) return peekBots();
    return loadBotsForRoute(params.botId).then((bots) => {
      const first = firstLiveBot(bots);
      if (!first) throw redirect({ to: "/onboarding" });
      if (!bots.some((bot) => bot.id === params.botId)) {
        throw redirect({ to: "/$botId", params: { botId: first.id } });
      }
      return bots;
    });
  },
  component: ChatPage,
});

function ChatPage() {
  const { botId } = Route.useParams();
  return <Chat botId={botId} />;
}
