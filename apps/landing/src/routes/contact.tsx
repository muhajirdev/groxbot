import { createFileRoute, Link } from "@tanstack/react-router";
import { Breadcrumbs, SiteChrome } from "../components/SiteChrome";
import { SupportChatLink } from "../components/SupportChat";
import { startUrl } from "../lib/app-url";
import { CONTACT_EMAIL, CONTACT_MAILTO } from "../lib/copy";
import { breadcrumbJsonLd } from "../lib/json-ld";
import { seoHead } from "../lib/site";

export const Route = createFileRoute("/contact")({
  loader: () => ({ startUrl: startUrl() }),
  head: () =>
    seoHead({
      title: "Contact",
      description:
        "Email Whip Computer sales and support. Self-host, pricing, or just hello.",
      path: "/contact",
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ]),
      ],
    }),
  component: ContactPage,
});

function ContactPage() {
  const { startUrl } = Route.useLoaderData();
  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[{ label: "Home", to: "/" }, { label: "Contact" }]}
        />
        <section className="hero !py-8 sm:!py-12 sm:!pb-10">
          <p className="kicker">Contact</p>
          <h1 className="!my-2 !mb-4">Talk to a person.</h1>
          <p className="lede !mb-5 !text-xl">
            Sales, self-host, press, or a stuck workspace. One mailbox. We read it.
          </p>
          <div className="row">
            <a className="btn lg" href={CONTACT_MAILTO}>
              Email {CONTACT_EMAIL}
            </a>
            <a className="btn ghost" href={startUrl}>
              Request an invite
            </a>
          </div>
        </section>

        <section className="py-2 pb-10" aria-label="Other paths">
          <p className="kicker">Also</p>
          <h2 className="!mb-4 !text-[clamp(28px,4vw,40px)]">
            Pick the short path.
          </h2>
          <div className="cards">
            <article className="card flex flex-col">
              <p className="kicker">Self-host</p>
              <h3 className="!mb-2 !text-xl">
                <Link
                  className="no-underline hover:underline"
                  to="/enterprise"
                >
                  Enterprise
                </Link>
              </h3>
              <p>Your data, your keys, your source.</p>
            </article>
            <article className="card flex flex-col">
              <p className="kicker">Hosted</p>
              <h3 className="!mb-2 !text-xl">
                <Link className="no-underline hover:underline" to="/pricing">
                  Pricing
                </Link>
              </h3>
              <p>Flat workspace plans. Trial on Pro.</p>
            </article>
            <article className="card flex flex-col">
              <p className="kicker">Product help</p>
              <h3 className="!mb-2 !text-xl">Chat</h3>
              <p className="!mb-4">
                Quick questions about Whip Computer — open chat from the footer or
                here.
              </p>
              <div className="mt-auto">
                <SupportChatLink />
              </div>
            </article>
          </div>
        </section>

        <section className="cta">
          <p className="kicker">Primary</p>
          <h2>{CONTACT_EMAIL}</h2>
          <p className="lede tight">
            That address is for people. Whip Computer is for the product.
          </p>
          <a className="btn lg" href={CONTACT_MAILTO}>
            Email us
          </a>
        </section>
      </main>
    </SiteChrome>
  );
}
