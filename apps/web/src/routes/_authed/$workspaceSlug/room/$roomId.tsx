import { createFileRoute, redirect } from "@tanstack/react-router";
import { OFFICE_TO, officeParams } from "../../../../lib/office-route";
import { officeSearch } from "../../../../lib/office-search";
import {
  catalogHasRoom,
  firstLiveBot,
  loadOfficeRoomCatalog,
} from "../../../../lib/session";
import { Chat } from "../../../../screens/Chat";

export const Route = createFileRoute("/_authed/$workspaceSlug/room/$roomId")({
  pendingMs: 1000,
  preloadStaleTime: 30_000,
  validateSearch: officeSearch,
  loader: async ({ params }) => {
    const { rooms, bots } = await loadOfficeRoomCatalog(params.roomId);
    if (catalogHasRoom(params.roomId, rooms, bots)) return rooms;
    const first = firstLiveBot(bots);
    if (!first) throw redirect({ to: "/onboarding", search: {} });
    throw redirect({
      to: OFFICE_TO,
      params: officeParams(
        params.workspaceSlug,
        first.homeRoomId || first.id,
      ),
    });
  },
  component: RoomPage,
});

function RoomPage() {
  const { roomId } = Route.useParams();
  const { workspace } = Route.useRouteContext();
  const desk = Route.useSearch();
  return <Chat roomId={roomId} workspace={workspace} desk={desk} />;
}
