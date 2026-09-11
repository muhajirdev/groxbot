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

export const Route = createFileRoute("/enterprise")({
  loader: () => ({ startUrl: startUrl() }),
  head: () =>
    seoHead({
      title: "Enterprise",
      description:
        "Self-host Groxbot for your team. Your data, your keys, your source on GitHub.",
      path: "/enterprise",
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Enterprise", path: "/enterprise" },
        ]),
      ],
    }),
  component: EnterprisePage,
});

function EnterprisePage() {
  const { startUrl } = Route.useLoaderData();
  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[{ label: "Home", to: "/" }, { label: "Enterprise" }]}
        />
        <section className="hero !py-8 sm:!py-12 sm:!pb-10">
          <p className="kicker">Enterprise</p>
          <h1 className="!my-2 !mb-4">Self-host. Enterprise ready.</h1>
          <p className="lede !mb-5 !text-xl">
            Keep the office on your machines. groxbot.com never sees the
            threads. The office still remembers — on your SQLite catalog. Model calls
            go to the key you paste.
          </p>
          <div className="row">
            <a className="btn lg" href={CONTACT_MAILTO}>
              Email {CONTACT_EMAIL}
            </a>
            <a
              className="btn ghost"
              href={SOURCE_REPO}
              target="_blank"
              rel="noreferrer"
            >
              View source
            </a>
          </div>
        </section>

        <section className="enterprise" aria-label="Enterprise facts">
          <div className="enterprise-copy">
            <p className="kicker">What stays yours</p>
            <h2>Data, keys, source.</h2>
            <p className="lede tight">
              Same product motion as hosted: named teammates, each with a
              computer, draft/approve in the thread. Deployed where security
              already works.
            </p>
            <div className="row">
              <Link className="btn ghost" to="/pricing">
                Hosted pricing
              </Link>
              <a className="btn ghost" href={startUrl}>
                Try hosted
              </a>
            </div>
          </div>
          <ul className="enterprise-facts">
            <li>
              <strong>Your data</strong>
              <span>Threads and computers stay in your deployment.</span>
            </li>
            <li>
              <strong>Your keys</strong>
              <span>Bring your own. Encrypted at rest. Not locked in.</span>
            </li>
            <li>
              <strong>Your source</strong>
              <span>Fair-code on GitHub. Security can inspect it.</span>
            </li>
          </ul>
        </section>

        <section className="cta">
          <p className="kicker">Talk to a person</p>
          <h2>Email {CONTACT_EMAIL}</h2>
          <p className="lede tight">
            Self-host questions, commercial licenses for hosting third parties,
            or a walkthrough. GitHub for the source.
          </p>
          <div className="row">
            <a className="btn" href={CONTACT_MAILTO}>
              Email sales
            </a>
            <a
              className="btn ghost"
              href={SOURCE_REPO}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
