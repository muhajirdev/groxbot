import { createFileRoute, Link } from "@tanstack/react-router";
import { Breadcrumbs, SiteChrome } from "../components/SiteChrome";
import { startUrl } from "../lib/app-url";
import {
  CONTACT_EMAIL,
  CONTACT_MAILTO,
  SOURCE_REPO,
} from "../lib/copy";
import { breadcrumbJsonLd } from "../lib/json-ld";
import { seoHead } from "../lib/site";

export const Route = createFileRoute("/terms")({
  loader: () => ({ startUrl: startUrl() }),
  head: () =>
    seoHead({
      title: "Terms",
      description:
        "Terms of use for Groxbot marketing and hosted service. Fair-code source on GitHub.",
      path: "/terms",
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Terms", path: "/terms" },
        ]),
      ],
    }),
  component: TermsPage,
});

function TermsPage() {
  const { startUrl } = Route.useLoaderData();
  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[{ label: "Home", to: "/" }, { label: "Terms" }]}
        />
        <section className="hero !py-8 sm:!py-12 sm:!pb-10">
          <p className="kicker">Terms</p>
          <h1 className="!my-2 !mb-4">Terms of use.</h1>
          <p className="lede !mb-3 !text-xl">
            Using the site and hosted product. Source is fair-code on GitHub.
            Last updated September 7, 2026.
          </p>
        </section>

        <div className="mx-auto flex max-w-2xl flex-col gap-10 pb-10">
          <section>
            <h2 className="!mb-3 !text-[clamp(24px,3.5vw,32px)]">
              The short version
            </h2>
            <p>
              Use Groxbot lawfully. Do not abuse the hosted service. Self-host
              for your own team is welcome. Running a competing hosted Groxbot
              cloud for third parties needs a commercial license — that is what
              groxbot.com is for.
            </p>
          </section>

          <section>
            <h2 className="!mb-3 !text-[clamp(24px,3.5vw,32px)]">
              Source and fair-code
            </h2>
            <p>
              Source lives at{" "}
              <a href={SOURCE_REPO} target="_blank" rel="noreferrer">
                {SOURCE_REPO}
              </a>
              . Read the repository license for the exact terms. In spirit:
              inspect and self-host for your organization; do not stand up a
              multi-tenant hosted Groxbot for other companies without a
              commercial agreement with us.
            </p>
          </section>

          <section>
            <h2 className="!mb-3 !text-[clamp(24px,3.5vw,32px)]">
              Hosted service
            </h2>
            <p>
              Hosted accounts are for running your team’s office. Acceptable use
              covers ordinary product work. Do not probe, overload, scrape, or
              attack the service; do not use it for illegal activity; do not
              try to bypass billing or access controls.
            </p>
            <p>
              We may suspend accounts that break these rules or put other
              customers at risk. Plans and pricing are described on{" "}
              <Link to="/pricing">Pricing</Link>.
            </p>
          </section>

          <section>
            <h2 className="!mb-3 !text-[clamp(24px,3.5vw,32px)]">
              Marketing site
            </h2>
            <p>
              Content on the marketing site is informational. Product behavior
              in the live office is what ships — not a promise beyond what the
              product does today.
            </p>
          </section>

          <section>
            <h2 className="!mb-3 !text-[clamp(24px,3.5vw,32px)]">Contact</h2>
            <p>
              Questions about these terms or commercial licensing:{" "}
              <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>. Privacy details:{" "}
              <Link to="/privacy">Privacy</Link>.
            </p>
          </section>
        </div>

        <section className="cta">
          <p className="kicker">Questions</p>
          <h2>Email {CONTACT_EMAIL}</h2>
          <div className="row">
            <a className="btn" href={CONTACT_MAILTO}>
              Email us
            </a>
            <a
              className="btn ghost"
              href={SOURCE_REPO}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a className="btn ghost" href={startUrl}>
              Request an invite
            </a>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
