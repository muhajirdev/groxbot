import { createFileRoute } from "@tanstack/react-router";
import { officeSearch } from "../../../lib/office-search";
import { Chat } from "../../../screens/Chat";

export const Route = createFileRoute("/_authed/$workspaceSlug/board")({
  validateSearch: officeSearch,
  component: BoardPage,
});

function BoardPage() {
  const { workspace } = Route.useRouteContext();
  const desk = Route.useSearch();
  return <Chat key={workspace.id} board workspace={workspace} desk={desk} />;
}
