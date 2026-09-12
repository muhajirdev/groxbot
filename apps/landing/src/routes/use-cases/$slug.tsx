import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BulletList, FaqList } from "../../components/ContentBits";
import {
  DemoThread,
  demoForUseCase,
  FirstMessageThread,
} from "../../components/DemoThread";
import { Breadcrumbs, SiteChrome } from "../../components/SiteChrome";
import { UseCaseApps } from "../../components/UseCaseApps";
import {
  getUseCase,
  getUseCaseCategory,
  relatedUseCases,
} from "../../data/use-cases";
import { startUrl } from "../../lib/app-url";
import { getIntegration } from "../../lib/integrations";
import { useCaseJsonLd } from "../../lib/json-ld";
import { seoHead } from "../../lib/site";

export const Route = createFileRoute("/use-cases/$slug")({
  loader: ({ params }) => {
    const item = getUseCase(params.slug);
    if (!item) throw notFound();
    return { startUrl: startUrl(), item };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.item) return {};
    const { item } = loaderData;
    return seoHead({
      title: `${item.title} with Whip Computer`,
      description: item.lede,
      path: `/use-cases/${item.slug}`,
      jsonLd: useCaseJsonLd(item),
    });
  },
  component: UseCasePage,
});

function UseCasePage() {
  const { startUrl, item } = Route.useLoaderData();
  const integrations = item.integrationSlugs
    .map((slug) => getIntegration(slug))
    .filter((row) => row !== undefined);
  const related = relatedUseCases(item, 4);
  const demo = demoForUseCase(item.slug);
  const category = getUseCaseCategory(item.category);

  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Use cases", to: "/use-cases" },
            ...(category
              ? [{ label: category.label, to: `/use-cases#${category.id}` }]
              : []),
            { label: item.title },
          ]}
        />
        <section className="hero !py-8 sm:!py-12 sm:!pb-10">
          <p className="kicker">
            {category ? `${category.label} · ` : ""}
            {item.kicker}
          </p>
          <h1 className="!my-2 !mb-4">{item.title}</h1>
          <p className="lede !mb-3 !text-xl">{item.lede}</p>
          <p className="thesis !mb-7 max-w-xl">{item.problem}</p>
          <UseCaseApps
            className="mb-7 flex list-none flex-wrap items-center gap-2.5 p-0"
            slugs={item.integrationSlugs}
            linked
          />
          <div className="row mt-1">
            <a className="btn lg" href={startUrl}>
              Request an invite
            </a>
          </div>
        </section>

        <section
          className="grid grid-cols-1 gap-4 py-2 pb-9 sm:gap-3.5 sm:pb-14 md:grid-cols-2"
          aria-label="How the job works"
        >
          <article className="rounded-3xl bg-[var(--wash)] px-[22px] py-[22px] pb-6 sm:px-7 sm:py-7 sm:pb-8">
            <h3 className="!mb-3 !text-[22px] tracking-[-0.03em]">
              What the Bot does
            </h3>
            <div className="[&_.points]:pt-1 [&_.points]:text-[15px] [&_.points]:leading-relaxed">
              <BulletList items={item.whatTheBotDoes} />
            </div>
          </article>
          <article className="rounded-3xl bg-[var(--wash)] px-[22px] py-[22px] pb-6 sm:px-7 sm:py-7 sm:pb-8">
            <h3 className="!mb-3 !text-[22px] tracking-[-0.03em]">
              Never without you
            </h3>
            <div className="[&_.points]:pt-1 [&_.points]:text-[15px] [&_.points]:leading-relaxed">
              <BulletList items={item.neverWithoutApproval} />
            </div>
          </article>
        </section>

        <section className="grid grid-cols-1 items-center gap-4 py-2 pb-9 sm:gap-10 sm:pb-16 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <h2 className="!mb-2.5 !text-[clamp(28px,4.2vw,44px)]">
              First message
            </h2>
            <p className="lede tight !mb-0">
              Talk first. The first message is a real task — not a template to
              configure.
            </p>
          </div>
          {demo ? (
            <DemoThread demo={demo} more={false} />
          ) : (
            <FirstMessageThread name={item.title} prompt={item.firstMessage} />
          )}
        </section>

        {integrations.length ? (
          <section className="py-2 pb-12">
            <h2>Tools this job uses</h2>
            <p className="lede tight">
              Connect them when the Bot hits a wall. Nothing goes live until
              you say so.
            </p>
            <div className="chips !my-1 !mb-0">
              {integrations.map((row) => (
                <Link
                  key={row.slug}
                  className="chip has-icon"
                  to="/integrations/$slug"
                  params={{ slug: row.slug }}
                >
                  {row.logo ? (
                    <img
                      className="chip-logo"
                      src={row.logo}
                      alt=""
                      width={18}
                      height={18}
                      decoding="async"
                    />
                  ) : null}
                  {row.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section id="faq" className="faq-band !py-6 !pb-4">
          <h2>FAQ</h2>
          <FaqList items={item.faqs} />
        </section>

        <section className="py-2 pb-12">
          <p className="kicker">Also hire</p>
          <h2>Other jobs</h2>
          <p className="lede tight">
            Hire for the work. Each Bot is a person in the sidebar.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {related.map((other) => (
              <article key={other.slug} className="card flex flex-col">
                <p className="kicker">{other.kicker}</p>
                <h2 className="!mb-2 !text-xl">
                  <Link
                    className="no-underline hover:underline"
                    to="/use-cases/$slug"
                    params={{ slug: other.slug }}
                  >
                    {other.title}
                  </Link>
                </h2>
                <p>{other.lede}</p>
                <UseCaseApps
                  className="mt-auto flex list-none flex-wrap items-center gap-2 p-0 pt-4"
                  slugs={other.integrationSlugs}
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
            Request an invite
          </a>
        </section>
      </main>
    </SiteChrome>
  );
}
