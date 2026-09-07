import { createFileRoute, Link } from "@tanstack/react-router";
import { Breadcrumbs, SiteChrome } from "../../components/SiteChrome";
import { appLoginUrl } from "../../lib/app-url";
import { LANDING_HIRE_BOTS } from "../../lib/bot-marketplace";
import { breadcrumbJsonLd, itemListJsonLd } from "../../lib/json-ld";
import { seoHead } from "../../lib/site";

type HireBot = (typeof LANDING_HIRE_BOTS)[number];

function botsByCategory(): Array<[string, HireBot[]]> {
  const map = new Map<string, HireBot[]>();
  for (const bot of LANDING_HIRE_BOTS) {
    const list = map.get(bot.category);
    if (list) list.push(bot);
    else map.set(bot.category, [bot]);
  }
  return [...map.entries()];
}

export const Route = createFileRoute("/templates/")({
  loader: () => ({
    startUrl: appLoginUrl(),
    groups: botsByCategory(),
    count: LANDING_HIRE_BOTS.length,
  }),
  head: () =>
    seoHead({
      title: "Templates",
      description:
        "Hire catalog packages — soul, memory, and starter skills. Not Zapier templates.",
      path: "/templates",
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Templates", path: "/templates" },
        ]),
        itemListJsonLd(
          "Groxbot hire templates",
          "/templates",
          LANDING_HIRE_BOTS.map((bot) => ({
            name: bot.name,
            path: `/templates/${bot.id}`,
          })),
        ),
      ],
    }),
  component: TemplatesIndex,
});

function TemplatesIndex() {
  const { startUrl, groups, count } = Route.useLoaderData();
  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[{ label: "Home", to: "/" }, { label: "Templates" }]}
        />
        <section className="hero !py-8 sm:!py-12 sm:!pb-10">
          <p className="kicker">Templates</p>
          <h1 className="!my-2 !mb-4">Hire packages, not Zapier templates.</h1>
          <p className="lede !mb-3 !text-xl">
            Each listing is a full teammate — soul, starter memory, and playbook
            skills. Same catalog as New bot in the office. {count} packages you
            can hire today.
          </p>
          <nav className="chips !mb-0" aria-label="Template categories">
            {groups.map(([category]) => (
              <a
                key={category}
                className="chip"
                href={`#${categorySlug(category)}`}
              >
                {category}
              </a>
            ))}
          </nav>
        </section>

        {groups.map(([category, bots]) => (
          <section
            key={category}
            id={categorySlug(category)}
            className="py-2 pb-10"
            aria-labelledby={`templates-${categorySlug(category)}`}
          >
            <p className="kicker">{category}</p>
            <h2
              id={`templates-${categorySlug(category)}`}
              className="!mb-4 !text-[clamp(28px,4vw,40px)]"
            >
              {category}
            </h2>
            <div className="cards hire-catalog-cards">
              {bots.map((bot) => (
                <article key={bot.id} className="card flex flex-col">
                  <p className="kicker">{bot.category}</p>
                  <h3 className="!mb-2 !text-xl">
                    <Link
                      className="no-underline hover:underline"
                      to="/templates/$slug"
                      params={{ slug: bot.id }}
                    >
                      {bot.name}
                    </Link>
                  </h3>
                  {bot.kind === "person" && bot.title ? (
                    <p className="hire-catalog-title">{bot.title}</p>
                  ) : null}
                  <p className="hire-catalog-blurb">{bot.blurb}</p>
                  <p className="hire-catalog-meta">
                    Soul · memory · {bot.skills.length} skill
                    {bot.skills.length === 1 ? "" : "s"}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}

        <section className="cta">
          <p className="kicker">Hire the first one</p>
          <h2>Meet your first Bot.</h2>
          <p className="lede tight">
            Pick a package. Open the thread. The first message is a real task.
          </p>
          <a className="btn lg" href={startUrl}>
            Get started
          </a>
        </section>
      </main>
    </SiteChrome>
  );
}

function categorySlug(category: string): string {
  return category.toLowerCase().replace(/\s+/g, "-");
}
