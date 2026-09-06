import { createFileRoute, redirect } from "@tanstack/react-router";
import { OFFICE_TO, officeParams } from "../../../lib/office-route";
import { officeSearch } from "../../../lib/office-search";
import { catalogHasRoom } from "../../../lib/session";
import { listedBots, listedRooms } from "../../../lib/workspace-catalog";
import {
  destinationAfterWorkspaceChange,
  readLastRoom,
} from "../../../lib/workspace-switcher";
import { Chat } from "../../../screens/Chat";

export const Route = createFileRoute("/_authed/$workspaceSlug/")({
  validateSearch: officeSearch,
  loader: ({ context }) => {
    const bots = listedBots();
    const rooms = listedRooms();
    const dest = destinationAfterWorkspaceChange(bots, {
      lastRoomId: readLastRoom(context.workspace.id),
      rooms,
    });
    if (
      dest.to === "/room/$roomId" &&
      catalogHasRoom(dest.roomId, rooms, bots)
    ) {
      throw redirect({
        to: OFFICE_TO,
        params: officeParams(context.workspace.slug, dest.roomId),
      });
    }
  },
  component: WorkspaceHomePage,
});

function WorkspaceHomePage() {
  const { workspace } = Route.useRouteContext();
  const desk = Route.useSearch();
  return <Chat key={workspace.id} workspace={workspace} desk={desk} />;
}
