import { createFileRoute, Link } from "@tanstack/react-router";
import { Breadcrumbs, SiteChrome } from "../../components/SiteChrome";
import { COMPARE_PAGES } from "../../data/compare";
import { appLoginUrl } from "../../lib/app-url";
import { breadcrumbJsonLd, itemListJsonLd } from "../../lib/json-ld";
import { seoHead } from "../../lib/site";

export const Route = createFileRoute("/compare/")({
  loader: () => ({ startUrl: appLoginUrl(), pages: COMPARE_PAGES }),
  head: () =>
    seoHead({
      title: "Compare",
      description:
        "Groxbot vs Hermes vs OpenClaw vs Paperclip — office teammates versus personal agents versus orchestration.",
      path: "/compare",
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Compare", path: "/compare" },
        ]),
        itemListJsonLd(
          "Groxbot comparisons",
          "/compare",
          COMPARE_PAGES.map((page) => ({
            name: page.title,
            path: `/compare/${page.slug}`,
          })),
        ),
      ],
    }),
  component: CompareIndex,
});

function CompareIndex() {
  const { startUrl, pages } = Route.useLoaderData();
  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[{ label: "Home", to: "/" }, { label: "Compare" }]}
        />
        <section className="hero !py-8 sm:!py-12 sm:!pb-10">
          <p className="kicker">Compare</p>
          <h1 className="!my-2 !mb-4">Office vs personal vs orchestration.</h1>
          <p className="lede !mb-3 !text-xl">
            Honest side-by-sides for the names people actually search.
          </p>
        </section>
        <section className="py-2 pb-6">
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {pages.map((page) => (
              <article key={page.slug} className="card flex flex-col">
                <p className="kicker">Comparison</p>
                <h2 className="!mb-2 !text-xl">
                  <Link
                    className="no-underline hover:underline"
                    to="/compare/$slug"
                    params={{ slug: page.slug }}
                  >
                    {page.title}
                  </Link>
                </h2>
                <p>{page.lede}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="cta">
          <p className="kicker">Skip the stack debate</p>
          <h2>Meet your first Bot.</h2>
          <p className="lede tight">
            Hire a teammate. Message it. Grant access when it hits a wall.
          </p>
          <a className="btn lg" href={startUrl}>
            Get started
          </a>
        </section>
      </main>
    </SiteChrome>
  );
}
