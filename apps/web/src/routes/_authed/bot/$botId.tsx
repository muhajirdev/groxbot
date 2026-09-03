import { createFileRoute, redirect } from "@tanstack/react-router";
import { botsCollection, peekBots } from "../../../lib/collections";
import { officeSearch } from "../../../lib/office-search";
import { firstLiveBot, loadBotsForRoute } from "../../../lib/session";
import { Chat } from "../../../screens/Chat";

export const Route = createFileRoute("/_authed/bot/$botId")({
  pendingMs: 1000,
  preloadStaleTime: 30_000,
  validateSearch: officeSearch,
  loader: ({ params }) => {
    if (botsCollection.has(params.botId)) {
      return peekBots();
    }
    return loadBotsForRoute(params.botId).then((bots) => {
      const first = firstLiveBot(bots);
      if (!first) throw redirect({ to: "/onboarding", search: {} });
      if (!bots.some((bot) => bot.id === params.botId)) {
        throw redirect({ to: "/bot/$botId", params: { botId: first.id } });
      }
      return bots;
    });
  },
  component: ChatPage,
});

function ChatPage() {
  const { botId } = Route.useParams();
  const desk = Route.useSearch();
  return <Chat botId={botId} desk={desk} />;
}
