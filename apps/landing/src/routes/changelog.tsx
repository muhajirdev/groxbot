import { createFileRoute } from "@tanstack/react-router";
import { Breadcrumbs, SiteChrome } from "../components/SiteChrome";
import { CHANGELOG } from "../data/changelog";
import { startUrl } from "../lib/app-url";
import { breadcrumbJsonLd } from "../lib/json-ld";
import { seoHead } from "../lib/site";

export const Route = createFileRoute("/changelog")({
  loader: () => ({ startUrl: startUrl(), entries: CHANGELOG }),
  head: () =>
    seoHead({
      title: "Changelog",
      description:
        "What shipped in Whip Computer — use cases, hire packages, knowledge.",
      path: "/changelog",
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Changelog", path: "/changelog" },
        ]),
      ],
    }),
  component: ChangelogPage,
});

function ChangelogPage() {
  const { startUrl, entries } = Route.useLoaderData();
  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[{ label: "Home", to: "/" }, { label: "Changelog" }]}
        />
        <section className="hero !py-8 sm:!py-12 sm:!pb-10">
          <p className="kicker">Changelog</p>
          <h1 className="!my-2 !mb-4">What shipped.</h1>
          <p className="lede !mb-3 !text-xl">
            Short product notes. No vapor. Link through when there’s a page.
          </p>
        </section>

        <section className="py-2 pb-10" aria-label="Entries">
          <div className="grid max-w-2xl gap-3.5">
            {entries.map((entry) => (
              <article
                key={`${entry.date}-${entry.title}`}
                className="card flex flex-col"
              >
                <p className="kicker">{entry.date}</p>
                <h2 className="!mb-2 !text-xl">
                  {entry.href ? (
                    entry.href.startsWith("http") ? (
                      <a
                        className="no-underline hover:underline"
                        href={entry.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {entry.title}
                      </a>
                    ) : (
                      <a
                        className="no-underline hover:underline"
                        href={entry.href}
                      >
                        {entry.title}
                      </a>
                    )
                  ) : (
                    entry.title
                  )}
                </h2>
                <p>{entry.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cta">
          <p className="kicker">Try it</p>
          <h2>Meet your first Bot.</h2>
          <p className="lede tight">
            Hire a teammate. Message it. Grant access when it hits a wall.
          </p>
          <a className="btn lg" href={startUrl}>
            Request an invite
          </a>
        </section>
      </main>
    </SiteChrome>
  );
}
