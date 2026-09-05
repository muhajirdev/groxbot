import { createFileRoute, notFound } from "@tanstack/react-router";
import { ShareDocument, ShareMissing } from "../../components/ShareReader";
import { loadPublicKnowledge } from "../../lib/public-knowledge";

type Search = { p?: string };

export const Route = createFileRoute("/s/$shareId")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    p:
      typeof search.p === "string" && search.p.trim()
        ? search.p.trim()
        : undefined,
  }),
  loaderDeps: ({ search }) => ({ p: search.p }),
  loader: async ({ params, deps }) => {
    const data = await loadPublicKnowledge(params.shareId, deps.p);
    if (!data) throw notFound();
    return { data, childPath: deps.p };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.data.title ?? "Shared note";
    const description =
      loaderData?.data.kind === "file"
        ? loaderData.data.description || "A shared office note."
        : "A shared office folder.";
    return {
      meta: [
        { title: `${title} — Groxbot` },
        { name: "description", content: description.slice(0, 160) },
        { name: "robots", content: "noindex, nofollow" },
        { name: "og:title", content: `${title} — Groxbot` },
        { name: "og:description", content: description.slice(0, 160) },
      ],
    };
  },
  notFoundComponent: ShareMissing,
  component: SharePage,
});

function SharePage() {
  const { shareId } = Route.useParams();
  const { data, childPath } = Route.useLoaderData();
  return (
    <ShareDocument shareId={shareId} childPath={childPath} data={data} />
  );
}
