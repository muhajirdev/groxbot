import { createFileRoute, redirect } from "@tanstack/react-router";
import { peekRooms, roomsCollection } from "../../../../lib/collections";
import { OFFICE_TO, officeParams } from "../../../../lib/office-route";
import { officeSearch } from "../../../../lib/office-search";
import { firstLiveBot, loadBotsForRoute } from "../../../../lib/session";
import { Chat } from "../../../../screens/Chat";

export const Route = createFileRoute("/_authed/$workspaceSlug/room/$roomId")({
  pendingMs: 1000,
  preloadStaleTime: 30_000,
  validateSearch: officeSearch,
  loader: async ({ params }) => {
    if (!roomsCollection.has(params.roomId)) {
      await roomsCollection.preload();
      if (!roomsCollection.has(params.roomId)) {
        await roomsCollection.utils.refetch();
      }
    }
    const rooms = peekRooms();
    if (!rooms.some((room) => room.id === params.roomId)) {
      const bots = await loadBotsForRoute();
      const first = firstLiveBot(bots);
      if (!first) throw redirect({ to: "/onboarding", search: {} });
      throw redirect({
        to: OFFICE_TO,
        params: officeParams(params.workspaceSlug, first.id),
      });
    }
    return rooms;
  },
  component: RoomPage,
});

function RoomPage() {
  const { roomId } = Route.useParams();
  const { workspace } = Route.useRouteContext();
  const desk = Route.useSearch();
  return <Chat roomId={roomId} workspace={workspace} desk={desk} />;
}
