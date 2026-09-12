import { createFileRoute, Link } from "@tanstack/react-router";
import { Breadcrumbs, SiteChrome } from "../components/SiteChrome";
import { startUrl } from "../lib/app-url";
import { CONTACT_EMAIL, CONTACT_MAILTO } from "../lib/copy";
import { breadcrumbJsonLd } from "../lib/json-ld";
import { seoHead } from "../lib/site";

export const Route = createFileRoute("/privacy")({
  loader: () => ({ startUrl: startUrl() }),
  head: () =>
    seoHead({
      title: "Privacy",
      description:
        "How Whip Computer handles marketing site data and hosted product data. Self-host keeps data on your machines.",
      path: "/privacy",
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Privacy", path: "/privacy" },
        ]),
      ],
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { startUrl } = Route.useLoaderData();
  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[{ label: "Home", to: "/" }, { label: "Privacy" }]}
        />
        <section className="hero !py-8 sm:!py-12 sm:!pb-10">
          <p className="kicker">Privacy</p>
          <h1 className="!my-2 !mb-4">Privacy policy.</h1>
          <p className="lede !mb-3 !text-xl">
            Straight talk about what we collect on whip.computer and what stays in
            your workspace. Last updated September 7, 2026.
          </p>
        </section>

        <div className="mx-auto flex max-w-2xl flex-col gap-10 pb-10">
          <section>
            <h2 className="!mb-3 !text-[clamp(24px,3.5vw,32px)]">
              This site (marketing)
            </h2>
            <p>
              Pages on the marketing site may use standard web logs (IP, user
              agent, path, referrer) to keep the site up and catch abuse. We do
              not sell that data. If we add analytics later, it will stay
              minimal and this page will say so.
            </p>
          </section>

          <section>
            <h2 className="!mb-3 !text-[clamp(24px,3.5vw,32px)]">
              Hosted product (whip.computer)
            </h2>
            <p>
              When you use hosted Whip Computer, we store the account and workspace
              data needed to run the product: roster, threads, knowledge you
              file, schedules, billing status, and settings you configure. That
              data is for operating your workspace — not for selling ads.
            </p>
            <p>
              A Bot talking to a model sends the prompt to the provider behind
              your key (or our hosted gateway when you use hosted models). Pick
              a provider with the retention terms you need. We do not claim
              zero retention: Whip Computer is meant to remember.
            </p>
          </section>

          <section>
            <h2 className="!mb-3 !text-[clamp(24px,3.5vw,32px)]">
              Self-host
            </h2>
            <p>
              If you self-host, your data stays in your deployment (your
              SQLite catalog, your Durable Objects, your keys). whip.computer does not
              see those threads. This policy still covers the marketing site and
              any account you keep on hosted whip.computer.
            </p>
          </section>

          <section>
            <h2 className="!mb-3 !text-[clamp(24px,3.5vw,32px)]">
              Cookies
            </h2>
            <p>
              We use cookies or similar storage needed to sign in and keep a
              session on the hosted product. The marketing site does not depend
              on advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="!mb-3 !text-[clamp(24px,3.5vw,32px)]">Contact</h2>
            <p>
              Privacy questions:{" "}
              <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>. Also see{" "}
              <Link to="/terms">Terms</Link> and{" "}
              <Link to="/enterprise">Enterprise / self-host</Link>.
            </p>
          </section>
        </div>

        <section className="cta">
          <p className="kicker">Questions</p>
          <h2>Email {CONTACT_EMAIL}</h2>
          <a className="btn" href={CONTACT_MAILTO}>
            Email us
          </a>
        </section>
      </main>
    </SiteChrome>
  );
}
