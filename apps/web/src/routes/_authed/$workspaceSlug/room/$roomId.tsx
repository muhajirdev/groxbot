import { createFileRoute, redirect } from "@tanstack/react-router";
import { officeSearch } from "../../../../lib/office-search";
import {
  loadOfficeRoomCatalog,
  unknownRoomRedirect,
} from "../../../../lib/session";
import { Chat } from "../../../../screens/Chat";

export const Route = createFileRoute("/_authed/$workspaceSlug/room/$roomId")({
  pendingMs: 1000,
  preloadStaleTime: 30_000,
  validateSearch: officeSearch,
  loader: async ({ params }) => {
    const { rooms, bots } = await loadOfficeRoomCatalog(params.roomId);
    const bounce = unknownRoomRedirect({
      roomId: params.roomId,
      workspaceSlug: params.workspaceSlug,
      rooms,
      bots,
    });
    if (!bounce) return rooms;
    throw redirect(bounce);
  },
  component: RoomPage,
});

function RoomPage() {
  const { roomId } = Route.useParams();
  const { workspace } = Route.useRouteContext();
  const desk = Route.useSearch();
  return <Chat key={workspace.id} roomId={roomId} workspace={workspace} desk={desk} />;
}
