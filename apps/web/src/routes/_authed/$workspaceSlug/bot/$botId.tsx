import { createFileRoute, redirect } from "@tanstack/react-router";
import { botsCollection, peekBots } from "../../../../lib/collections";
import { OFFICE_TO, officeParams } from "../../../../lib/office-route";
import { officeSearch } from "../../../../lib/office-search";
import { firstLiveBot, loadBotsForRoute } from "../../../../lib/session";

/** Old `/bot/$botId` bookmarks open that person’s home room. */
export const Route = createFileRoute("/_authed/$workspaceSlug/bot/$botId")({
  pendingMs: 1000,
  preloadStaleTime: 30_000,
  validateSearch: officeSearch,
  loader: async ({ params, search }) => {
    const bots = botsCollection.has(params.botId)
      ? peekBots()
      : await loadBotsForRoute(params.botId);
    const bot = bots.find((item) => item.id === params.botId);
    const first = firstLiveBot(bots);
    const roomId = bot?.homeRoomId || first?.homeRoomId || first?.id;
    if (!roomId) throw redirect({ to: "/onboarding", search: {} });
    throw redirect({
      to: OFFICE_TO,
      params: officeParams(params.workspaceSlug, roomId),
      search,
    });
  },
});
