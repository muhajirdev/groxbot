import { createFileRoute, Link } from "@tanstack/react-router";
import { IntegrationGrid } from "../../components/IntegrationCard";
import { Breadcrumbs, SiteChrome } from "../../components/SiteChrome";
import { appAccessUrl } from "../../lib/app-url";
import {
  computerIntegrations,
  featuredIntegrations,
  integrationCategories,
  searchIntegrations,
} from "../../lib/integrations";
import { breadcrumbJsonLd, itemListJsonLd } from "../../lib/json-ld";
import { seoHead } from "../../lib/site";

type Search = { q?: string };

export const Route = createFileRoute("/integrations/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q ?? "" }),
  loader: ({ deps }) => {
    const q = deps.q.trim();
    const matches = q ? searchIntegrations(q).slice(0, 80) : [];
    return {
      startUrl: appAccessUrl(),
      q,
      matches,
      featured: featuredIntegrations(),
      indie: computerIntegrations(),
      categories: integrationCategories(),
      popular: searchIntegrations("")
        .filter((item) => item.kind === "composio")
        .slice(0, 24),
    };
  },
  head: ({ loaderData }) => {
    const q = loaderData?.q;
    return seoHead({
      title: q ? `Integrations matching “${q}”` : "Integrations",
      description:
        "Gmail, Slack, GitHub, Typefully — plus a computer for indie tools like DataFast, Postiz, and Post Bridge.",
      path: "/integrations",
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Integrations", path: "/integrations" },
        ]),
        itemListJsonLd(
          "Groxbot integrations",
          "/integrations",
          (loaderData?.featured ?? []).map((item) => ({
            name: item.name,
            path: `/integrations/${item.slug}`,
          })),
        ),
      ],
    });
  },
  component: IntegrationsIndex,
});

function IntegrationsIndex() {
  const { startUrl, q, matches, featured, indie, categories, popular } =
    Route.useLoaderData();

  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[{ label: "Home", to: "/" }, { label: "Integrations" }]}
        />
        <section className="hero pb-12">
          <p className="kicker">Integrations</p>
          <h1>Gmail, Slack, GitHub — plus a computer for the rest.</h1>
          <p className="lede">
            Connect the tools you already use. DataFast, Postiz, Post Bridge,
            and the rest of the indie stack run on the Bot&apos;s computer until
            a connector exists.
          </p>
          <form className="search-form" method="get" action="/integrations">
            <label className="sr-only" htmlFor="q">
              Search integrations
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search Gmail, DataFast, Postiz…"
            />
            <button className="btn" type="submit">
              Search
            </button>
          </form>
        </section>

        {q ? (
          <section className="band">
            <h2>
              {matches.length} match{matches.length === 1 ? "" : "es"} for “{q}”
            </h2>
            <IntegrationGrid items={matches} />
          </section>
        ) : (
          <div className="flex flex-col gap-12">
            <section className="band">
              <h2>Indie tools on the computer</h2>
              <p className="lede tight">
                Marc Lou, Jack Friks, Nevo David — products that live in a
                dashboard. The Bot still works there, then stops before publish.
              </p>
              <IntegrationGrid items={indie} />
            </section>
            <section className="band">
              <h2>Featured tools</h2>
              <IntegrationGrid
                items={featured.filter((item) => item.kind === "composio")}
              />
            </section>
            <section className="band">
              <h2>Browse by category</h2>
              <div className="chips !mb-0">
                {categories.slice(0, 24).map((item) => (
                  <Link
                    key={item.slug}
                    className="chip"
                    to="/integrations/category/$category"
                    params={{ category: item.slug }}
                  >
                    {item.name}
                    <span className="chip-count">{item.count}</span>
                  </Link>
                ))}
              </div>
            </section>
            <section className="band">
              <h2>Popular connectors</h2>
              <IntegrationGrid items={popular} />
            </section>
          </div>
        )}

        <section className="cta">
          <a className="btn" href={startUrl}>
            Request access
          </a>
        </section>
      </main>
    </SiteChrome>
  );
}
