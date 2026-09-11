import { createFileRoute, Link } from "@tanstack/react-router";
import { FaqList } from "../components/ContentBits";
import { Breadcrumbs, SiteChrome } from "../components/SiteChrome";
import { PRICING_FAQS, PRICING_PLANS } from "../data/pricing";
import { startUrl } from "../lib/app-url";
import { CONTACT_MAILTO, SOURCE_REPO } from "../lib/copy";
import { breadcrumbJsonLd, faqJsonLd } from "../lib/json-ld";
import { seoHead } from "../lib/site";

export const Route = createFileRoute("/pricing")({
  loader: () => ({ startUrl: startUrl(), plans: PRICING_PLANS }),
  head: () =>
    seoHead({
      title: "Pricing",
      description:
        "Flat workspace plans for the Groxbot office. Self-host free. No per-seat tax.",
      path: "/pricing",
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ]),
        faqJsonLd(PRICING_FAQS),
      ],
    }),
  component: PricingPage,
});

function PricingPage() {
  const { startUrl, plans } = Route.useLoaderData();
  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[{ label: "Home", to: "/" }, { label: "Pricing" }]}
        />
        <section className="hero !py-8 sm:!py-12 sm:!pb-10">
          <p className="kicker">Pricing</p>
          <h1 className="!my-2 !mb-4">Flat for the office. Not per seat.</h1>
          <p className="lede !mb-3 !text-xl">
            Hire teammates. Message them. Grant access when they hit a wall.
            Hosted on groxbot.com — or self-host free.
          </p>
        </section>

        <section className="py-2 pb-10" aria-label="Plans">
          <div className="cards">
            {plans.map((plan) => (
              <article key={plan.id} className="card flex flex-col">
                <p className="kicker">{plan.popular ? "Popular" : "Plan"}</p>
                <h2 className="!mb-1 !text-xl">{plan.name}</h2>
                <p className="!mb-3">{plan.blurb}</p>
                <ul className="points !mb-4">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <p className="!mb-4 !text-sm !text-[var(--muted)]">
                  {plan.note}
                </p>
                <a className="btn mt-auto" href={startUrl}>
                  {plan.cta}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="enterprise" aria-label="Self-host">
          <div className="enterprise-copy">
            <p className="kicker">Self-host</p>
            <h2>Run it yourself. Free.</h2>
            <p className="lede tight">
              Your SQLite catalog. Your keys. Source on GitHub. Hosted groxbot.com is
              the paid product — self-host for your own team costs nothing.
            </p>
            <div className="row">
              <Link className="btn ghost" to="/enterprise">
                Enterprise
              </Link>
              <a
                className="btn ghost"
                href={SOURCE_REPO}
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              <a className="btn ghost" href={CONTACT_MAILTO}>
                Talk to us
              </a>
            </div>
          </div>
          <ul className="enterprise-facts">
            <li>
              <strong>Your data</strong>
              <span>Threads stay in your deployment.</span>
            </li>
            <li>
              <strong>Your keys</strong>
              <span>BYOK. Not locked to one vendor.</span>
            </li>
            <li>
              <strong>Your source</strong>
              <span>Fair-code. Security can inspect it.</span>
            </li>
          </ul>
        </section>

        <section id="faq" className="faq-band !py-6 !pb-4">
          <h2>FAQ</h2>
          <FaqList items={PRICING_FAQS} />
        </section>

        <section className="cta">
          <p className="kicker">Start with a trial</p>
          <h2>Meet your first Bot.</h2>
          <p className="lede tight">
            Name it. Open the thread. Give it a real task.
          </p>
          <a className="btn lg" href={startUrl}>
            Request an invite
          </a>
        </section>
      </main>
    </SiteChrome>
  );
}
