import { createFileRoute, notFound } from "@tanstack/react-router";
import { ShareDocument, ShareMissing } from "../../components/ShareReader";
import { loadPublicKnowledge } from "../../lib/public-knowledge";
import { seoHead } from "../../lib/site";

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
    return { data, childPath: deps.p, shareId: params.shareId };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.data.title ?? "Shared note";
    const description =
      loaderData?.data.kind === "file"
        ? loaderData.data.description || "A shared office note."
        : "A shared office folder.";
    return seoHead({
      title,
      description,
      path: `/s/${loaderData?.shareId ?? ""}`,
      robots: "noindex, nofollow",
    });
  },
  notFoundComponent: ShareMissing,
  component: SharePage,
});

function SharePage() {
  const { shareId } = Route.useParams();
  const { data, childPath } = Route.useLoaderData();
  return <ShareDocument shareId={shareId} childPath={childPath} data={data} />;
}
