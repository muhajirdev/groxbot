import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BulletList } from "../../components/ContentBits";
import { Breadcrumbs, SiteChrome } from "../../components/SiteChrome";
import { startUrl } from "../../lib/app-url";
import { LANDING_HIRE_BOTS } from "../../lib/bot-marketplace";
import { breadcrumbJsonLd } from "../../lib/json-ld";
import { seoHead } from "../../lib/site";

function findBot(slug: string) {
  return LANDING_HIRE_BOTS.find((bot) => bot.id === slug);
}

function relatedBots(slug: string, category: string, limit = 4) {
  return LANDING_HIRE_BOTS.filter(
    (bot) => bot.category === category && bot.id !== slug,
  ).slice(0, limit);
}

export const Route = createFileRoute("/templates/$slug")({
  loader: ({ params }) => {
    const bot = findBot(params.slug);
    if (!bot) throw notFound();
    return {
      startUrl: startUrl(),
      bot,
      related: relatedBots(bot.id, bot.category),
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.bot) return {};
    const { bot } = loaderData;
    return seoHead({
      title: `${bot.name} template`,
      description: bot.blurb,
      path: `/templates/${bot.id}`,
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Templates", path: "/templates" },
          { name: bot.name, path: `/templates/${bot.id}` },
        ]),
      ],
    });
  },
  component: TemplatePage,
});

function TemplatePage() {
  const { startUrl, bot, related } = Route.useLoaderData();
  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Templates", to: "/templates" },
            { label: bot.name },
          ]}
        />
        <section className="hero !py-8 sm:!py-12 sm:!pb-10">
          <p className="kicker">{bot.category}</p>
          <h1 className="!my-2 !mb-4">{bot.name}</h1>
          <p className="lede !mb-3 !text-xl">{bot.blurb}</p>
          {bot.kind === "person" && bot.title ? (
            <p className="thesis !mb-5 max-w-xl">{bot.title}</p>
          ) : null}
          <div className="row mt-1">
            <a className="btn lg" href={startUrl}>
              Hire {bot.name}
            </a>
            <Link className="btn ghost" to="/templates">
              All templates
            </Link>
          </div>
        </section>

        <section
          className="grid grid-cols-1 gap-4 py-2 pb-9 sm:gap-3.5 sm:pb-14 md:grid-cols-2"
          aria-label="Package contents"
        >
          <article className="rounded-3xl bg-[var(--wash)] px-[22px] py-[22px] pb-6 sm:px-7 sm:py-7 sm:pb-8">
            <h3 className="!mb-3 !text-[22px] tracking-[-0.03em]">Soul</h3>
            <p className="!m-0 text-[15px] leading-relaxed text-[var(--muted)]">
              {bot.soul}
            </p>
          </article>
          <article className="rounded-3xl bg-[var(--wash)] px-[22px] py-[22px] pb-6 sm:px-7 sm:py-7 sm:pb-8">
            <h3 className="!mb-3 !text-[22px] tracking-[-0.03em]">Memory</h3>
            <p className="!m-0 text-[15px] leading-relaxed text-[var(--muted)]">
              {bot.memory}
            </p>
          </article>
        </section>

        <section className="py-2 pb-12">
          <p className="kicker">Skills</p>
          <h2 className="!mb-2.5">Starter playbooks</h2>
          <p className="lede tight !mb-5">
            Installed into shared knowledge on hire. Draft for you; nothing goes
            live until you say so.
          </p>
          <BulletList
            items={bot.skills.map(
              (skill) => `${skill.name} — ${skill.description}`,
            )}
          />
        </section>

        {related.length ? (
          <section className="py-2 pb-12">
            <p className="kicker">Also in {bot.category}</p>
            <h2>Related packages</h2>
            <div className="mt-2 grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {related.map((other) => (
                <article key={other.id} className="card flex flex-col">
                  <p className="kicker">{other.category}</p>
                  <h3 className="!mb-2 !text-xl">
                    <Link
                      className="no-underline hover:underline"
                      to="/templates/$slug"
                      params={{ slug: other.id }}
                    >
                      {other.name}
                    </Link>
                  </h3>
                  <p>{other.blurb}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="cta">
          <p className="kicker">Hire this Bot</p>
          <h2>Open the thread.</h2>
          <p className="lede tight">
            Soul, memory, and skills come with the hire. First message is a real
            task.
          </p>
          <a className="btn lg" href={startUrl}>
            Hire {bot.name}
          </a>
        </section>
      </main>
    </SiteChrome>
  );
}
