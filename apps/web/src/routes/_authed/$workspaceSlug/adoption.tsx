import { createFileRoute } from "@tanstack/react-router";
import { officeSearch } from "../../../lib/office-search";
import { Chat } from "../../../screens/Chat";

export const Route = createFileRoute("/_authed/$workspaceSlug/adoption")({
  validateSearch: officeSearch,
  component: AdoptionPage,
});

function AdoptionPage() {
  const { workspace } = Route.useRouteContext();
  const desk = Route.useSearch();
  return <Chat key={workspace.id} adoption workspace={workspace} desk={desk} />;
}
