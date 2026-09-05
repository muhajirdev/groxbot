import { createFileRoute, Link } from "@tanstack/react-router";
import { Breadcrumbs, SiteChrome } from "../../components/SiteChrome";
import { COMPARE_PAGES, PRIMARY_COMPARE_SLUG } from "../../data/compare";
import { appLoginUrl } from "../../lib/app-url";
import { breadcrumbJsonLd, itemListJsonLd } from "../../lib/json-ld";
import { seoHead } from "../../lib/site";

export const Route = createFileRoute("/compare/")({
  loader: () => {
    const featured = COMPARE_PAGES.find(
      (page) => page.slug === PRIMARY_COMPARE_SLUG,
    );
    const pairwise = COMPARE_PAGES.filter(
      (page) => page.slug !== PRIMARY_COMPARE_SLUG,
    );
    return { startUrl: appLoginUrl(), featured, pairwise };
  },
  head: () =>
    seoHead({
      title: "Compare",
      description:
        "Groxbot vs Hermes vs OpenClaw vs Paperclip — feature tables for multiplayer, knowledge base, BYOK, and more.",
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
  const { startUrl, featured, pairwise } = Route.useLoaderData();
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
            Feature tables with checks and crosses. Multiplayer and a shared
            knowledge base are the gap.
          </p>
        </section>

        {featured ? (
          <section className="py-2 pb-8" aria-labelledby="all-heading">
            <p className="kicker">All four</p>
            <h2 id="all-heading" className="!mb-3 !text-[clamp(28px,4vw,40px)]">
              <Link
                className="no-underline hover:underline"
                to="/compare/$slug"
                params={{ slug: featured.slug }}
              >
                {featured.title}
              </Link>
            </h2>
            <p className="lede tight !mb-0 max-w-2xl">{featured.lede}</p>
          </section>
        ) : null}

        <section className="py-2 pb-6" aria-labelledby="pair-heading">
          <p className="kicker">Pairwise</p>
          <h2 id="pair-heading" className="!mb-4">
            Each vs
          </h2>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {pairwise.map((page) => (
              <article key={page.slug} className="card flex flex-col">
                <p className="kicker">
                  {page.products.map((product) => product.shortName).join(" · ")}
                </p>
                <h3 className="!mb-2 !text-xl">
                  <Link
                    className="no-underline hover:underline"
                    to="/compare/$slug"
                    params={{ slug: page.slug }}
                  >
                    {page.title}
                  </Link>
                </h3>
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
