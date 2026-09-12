import { createFileRoute, Link } from "@tanstack/react-router";
import { Breadcrumbs, SiteChrome } from "../components/SiteChrome";
import { appLoginUrl, startUrl } from "../lib/app-url";
import { MAC_DMG_URL } from "../lib/copy";
import { breadcrumbJsonLd } from "../lib/json-ld";
import { seoHead } from "../lib/site";

export const Route = createFileRoute("/download")({
  loader: () => ({ startUrl: startUrl(), officeUrl: appLoginUrl() }),
  head: () =>
    seoHead({
      title: "Download Mac app",
      description:
        "Whip Computer for Mac (Apple Silicon). A window around the hosted product.",
      path: "/download",
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Download", path: "/download" },
        ]),
      ],
    }),
  component: DownloadPage,
});

function DownloadPage() {
  const { startUrl, officeUrl } = Route.useLoaderData();
  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[{ label: "Home", to: "/" }, { label: "Download" }]}
        />
        <section className="hero !py-8 sm:!py-12 sm:!pb-10">
          <p className="kicker">Mac</p>
          <h1 className="!my-2 !mb-4">Whip Computer for Mac.</h1>
          <p className="lede !mb-5 !text-xl">
            Apple Silicon. Opens hosted Whip Computer in a window — same product
            as the browser.
          </p>
          <div className="row">
            <a className="btn lg" href={MAC_DMG_URL}>
              Download .dmg
            </a>
            <a className="btn ghost" href={officeUrl}>
              Use in the browser
            </a>
          </div>
        </section>

        <section className="py-2 pb-10" aria-label="Install">
          <p className="kicker">Install</p>
          <h2 className="!mb-4 !text-[clamp(28px,4vw,40px)]">
            Three steps. About a minute.
          </h2>
          <div className="cards">
            <article className="card flex flex-col">
              <p className="kicker">1</p>
              <h3 className="!mb-2 !text-xl">Open the disk image</h3>
              <p>
                Download the .dmg, open it, and drag Whip Computer into
                Applications. The disk image also has a “How to open” note.
              </p>
            </article>
            <article className="card flex flex-col">
              <p className="kicker">2</p>
              <h3 className="!mb-2 !text-xl">Right-click → Open</h3>
              <p>
                This build is not signed yet, so a normal double-click is
                blocked. In Finder, right-click Whip Computer, choose Open, then
                confirm Open. You only do this once.
              </p>
            </article>
            <article className="card flex flex-col">
              <p className="kicker">3</p>
              <h3 className="!mb-2 !text-xl">Sign in</h3>
              <p>
                Use the same account as the web app. Apple Silicon only —
                Intel Macs are not in this file.
              </p>
            </article>
          </div>
        </section>

        <section className="cta">
          <p className="kicker">Browser</p>
          <h2>No download needed.</h2>
          <p className="lede tight">
            Whip Computer is the product. The Mac app is a window around it.
          </p>
          <a className="btn lg" href={officeUrl}>
            Open Whip Computer
          </a>
          <Link className="btn ghost" to="/pricing">
            Pricing
          </Link>
        </section>
      </main>
    </SiteChrome>
  );
}
