import { createFileRoute, Link } from "@tanstack/react-router";
import { Breadcrumbs, SiteChrome } from "../../components/SiteChrome";
import { UseCaseApps } from "../../components/UseCaseApps";
import { USE_CASES } from "../../data/use-cases";
import { appAccessUrl } from "../../lib/app-url";
import { breadcrumbJsonLd, itemListJsonLd } from "../../lib/json-ld";
import { seoHead } from "../../lib/site";

export const Route = createFileRoute("/use-cases/")({
  loader: () => ({ startUrl: appAccessUrl(), items: USE_CASES }),
  head: () =>
    seoHead({
      title: "Use cases",
      description:
        "Hire a Groxbot teammate for sales, social, analytics, inbox, and shipping. No workflow builder.",
      path: "/use-cases",
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Use cases", path: "/use-cases" },
        ]),
        itemListJsonLd(
          "Groxbot use cases",
          "/use-cases",
          USE_CASES.map((item) => ({
            name: item.title,
            path: `/use-cases/${item.slug}`,
          })),
        ),
      ],
    }),
  component: UseCasesIndex,
});

function UseCasesIndex() {
  const { startUrl, items } = Route.useLoaderData();
  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[{ label: "Home", to: "/" }, { label: "Use cases" }]}
        />
        <section className="hero !py-8 sm:!py-12 sm:!pb-10">
          <p className="kicker">Use cases</p>
          <h1 className="!my-2 !mb-4">
            Hire for the work, not a template gallery.
          </h1>
          <p className="lede !mb-3 !text-xl">
            Each Bot is a person in the sidebar. Job title optional. These are
            the jobs founders actually message first.
          </p>
        </section>
        <section className="py-2 pb-6">
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
            {items.map((item) => (
              <article key={item.slug} className="card flex flex-col">
                <p className="kicker">{item.kicker}</p>
                <h2 className="!mb-2 !text-xl">
                  <Link
                    className="no-underline hover:underline"
                    to="/use-cases/$slug"
                    params={{ slug: item.slug }}
                  >
                    {item.title}
                  </Link>
                </h2>
                <p>{item.lede}</p>
                <UseCaseApps
                  className="mt-auto flex list-none flex-wrap items-center gap-2 p-0 pt-4"
                  slugs={item.integrationSlugs}
                />
              </article>
            ))}
          </div>
        </section>
        <section className="cta">
          <p className="kicker">Hire the first one</p>
          <h2>Meet your first Bot.</h2>
          <p className="lede tight">
            Name, optional job, how it should work. Open the thread. The first
            message is a real task.
          </p>
          <a className="btn lg" href={startUrl}>
            Request access
          </a>
        </section>
      </main>
    </SiteChrome>
  );
}
