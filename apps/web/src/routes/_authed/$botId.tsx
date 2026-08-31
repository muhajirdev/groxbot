import { createFileRoute, redirect } from "@tanstack/react-router";
import { botsCollection, peekBots } from "../../lib/collections";
import { firstLiveBot, loadBotsForRoute } from "../../lib/session";
import { thinkMessagesQueryOptions } from "../../lib/think-messages";
import { Chat } from "../../screens/Chat";

export const Route = createFileRoute("/_authed/$botId")({
  pendingMs: 1000,
  preloadStaleTime: 30_000,
  loader: ({ params, context }) => {
    const prefetch = (botId: string) => {
      void context.queryClient.prefetchQuery(thinkMessagesQueryOptions(botId));
    };
    if (botsCollection.has(params.botId)) {
      prefetch(params.botId);
      return peekBots();
    }
    return loadBotsForRoute(params.botId).then((bots) => {
      const first = firstLiveBot(bots);
      if (!first) throw redirect({ to: "/onboarding", search: {} });
      if (!bots.some((bot) => bot.id === params.botId)) {
        throw redirect({ to: "/$botId", params: { botId: first.id } });
      }
      prefetch(params.botId);
      return bots;
    });
  },
  component: ChatPage,
});

function ChatPage() {
  const { botId } = Route.useParams();
  return <Chat botId={botId} />;
}
