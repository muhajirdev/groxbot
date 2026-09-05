import { MascotMark } from "@groxbot/mascot";
import {
  PRESS_ASSETS,
  PRESS_BOILERPLATE,
  PRESS_COLORS,
  PRESS_NAMES_NO,
  PRESS_NAMES_OK,
  PRESS_VOICE,
  pressFacts,
} from "@groxbot/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OfficePreview } from "../../components/OfficePreview";
import { Breadcrumbs, SiteChrome } from "../../components/SiteChrome";
import { appLoginUrl } from "../../lib/app-url";
import { cn } from "../../lib/cn";
import { CONTACT_EMAIL, CONTACT_MAILTO, SOURCE_REPO } from "../../lib/copy";
import { LANDING_ORIGINS } from "../../lib/discovery";
import { breadcrumbJsonLd } from "../../lib/json-ld";
import { pressAssetHref } from "../../lib/press-assets";
import { seoHead } from "../../lib/site";

export const Route = createFileRoute("/press/")({
  loader: () => ({
    startUrl: appLoginUrl(),
    facts: pressFacts(LANDING_ORIGINS),
  }),
  head: () =>
    seoHead({
      title: "Press kit",
      description:
        "Groxbot logos, naming rules, and boilerplate for journalists and partners.",
      path: "/press",
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Press kit", path: "/press" },
        ]),
      ],
    }),
  component: PressPage,
});

function PressPage() {
  const { startUrl, facts } = Route.useLoaderData();
  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[{ label: "Home", to: "/" }, { label: "Press kit" }]}
        />

        <section className="hero !py-8 sm:!py-12 sm:!pb-10">
          <p className="kicker">Press kit</p>
          <h1 className="!my-2 !mb-4">Logos, naming, and boilerplate.</h1>
          <p className="lede !mb-5 !text-xl">
            Use this when you write about Groxbot. The mark is the pink mascot.
            The name is one word, capital G.
          </p>
          <div className="row">
            <a
              className="btn"
              href={pressAssetHref("groxbot-mark.svg")}
              download
            >
              Download mark
            </a>
            <a className="btn ghost" href="/press.md">
              Markdown
            </a>
          </div>
        </section>

        <div className="flex flex-col gap-12 pb-4 sm:gap-14">
          <section className="py-2">
            <p className="kicker">Boilerplate</p>
            <h2 className="!mb-4 !text-[clamp(28px,4.2vw,40px)]">Copy this.</h2>
            <div className="grid max-w-2xl gap-3.5">
              {PRESS_BOILERPLATE.map((item) => (
                <CopyBlock key={item.id} label={item.label} text={item.text} />
              ))}
            </div>
          </section>

          <section className="py-2">
            <p className="kicker">Facts</p>
            <h2 className="!mb-4 !text-[clamp(28px,4.2vw,40px)]">
              What to print.
            </h2>
            <dl className="m-0 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  className="rounded-[14px] border border-[var(--line)] bg-[var(--card)] px-[18px] py-4"
                >
                  <dt className="mb-1.5 text-xs text-[var(--muted)]">
                    {fact.label}
                  </dt>
                  <dd className="m-0 text-[15px]">
                    {fact.href ? (
                      <a
                        className="text-inherit no-underline hover:underline"
                        href={fact.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {fact.value}
                      </a>
                    ) : (
                      fact.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="py-2">
            <p className="kicker">Name</p>
            <h2 className="!mb-4 !text-[clamp(28px,4.2vw,40px)]">
              Groxbot. Not Grokbot.
            </h2>
            <div className="mb-4 grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <article className="card">
                <h3 className="!mb-2 !text-xl">Use</h3>
                <ul className="points">
                  {PRESS_NAMES_OK.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article className="card">
                <h3 className="!mb-2 !text-xl">Do not use</h3>
                <ul className="points">
                  {PRESS_NAMES_NO.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>
            <ul className="points">
              {PRESS_VOICE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="py-2">
            <p className="kicker">Logos</p>
            <h2 className="!mb-2.5 !text-[clamp(28px,4.2vw,40px)]">
              SVG for print. PNG for crawlers.
            </h2>
            <p className="lede tight !mb-5">
              Keep the mascot pink. Two slits, no mouth, no photoreal head. Do
              not add drop shadows or outlines. Wordmark type is Source Sans 3,
              same as the site. Link previews use the 1200×630 PNG at{" "}
              <a href="/og.png">/og.png</a>.
            </p>
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {PRESS_ASSETS.map((asset) => {
                const light = asset.file.includes("light");
                const og = asset.file.includes("-og.");
                return (
                  <article
                    key={asset.file}
                    className={cn(
                      "grid justify-items-start gap-2.5 rounded-[var(--radius)] border border-[var(--line)] p-5",
                      light
                        ? "bg-[#f4f4f4] text-[#171614] [&_.kicker]:text-[#6b675f] [&_p]:text-[#6b675f] [&_.btn.ghost]:border-current [&_.btn.ghost]:text-inherit"
                        : "bg-[var(--card)]",
                      og && "md:col-span-2",
                    )}
                  >
                    <LogoPreview file={asset.file} label={asset.label} />
                    <p className="kicker !m-0">{asset.label}</p>
                    <p className="!m-0 text-sm leading-relaxed">{asset.note}</p>
                    <div className="row !m-0">
                      <a
                        className="btn ghost"
                        href={pressAssetHref(asset.file)}
                        download={asset.file}
                      >
                        Download SVG
                      </a>
                      {og ? (
                        <a
                          className="btn ghost"
                          href="/og.png"
                          download="groxbot-og.png"
                        >
                          Download PNG
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="py-2">
            <p className="kicker">Color</p>
            <h2 className="!mb-4 !text-[clamp(28px,4.2vw,40px)]">Four inks.</h2>
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
              {PRESS_COLORS.map((color) => (
                <article
                  key={color.hex}
                  className="card overflow-hidden !p-0 pb-4"
                >
                  <div
                    className="mb-3 h-[88px]"
                    style={{ background: color.hex }}
                  />
                  <h3 className="!mb-1 !px-4 !text-lg">{color.name}</h3>
                  <p className="!px-4">
                    {color.hex}
                    <br />
                    {color.note}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="py-2 pb-6">
            <p className="kicker">Product</p>
            <h2 className="!mb-2.5 !text-[clamp(28px,4.2vw,40px)]">
              The office is a messaging app.
            </h2>
            <p className="lede tight !mb-5">
              Sidebar of Bots, one thread, computer pane you can ignore. Use
              this shot — not private workspace threads.
            </p>
            <OfficePreview />
          </section>
        </div>

        <section className="cta">
          <p className="kicker">Contact</p>
          <h2>Press: {CONTACT_EMAIL}</h2>
          <p className="lede tight">
            That mailbox is for press and people. GitHub for the source. Naming
            rules for machines: <a href="/brand.txt">/brand.txt</a>.
          </p>
          <div className="row">
            <a className="btn" href={CONTACT_MAILTO}>
              Email {CONTACT_EMAIL}
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
              Get started
            </a>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}

function LogoPreview(props: { file: string; label: string }) {
  const light = props.file.includes("light");
  const framed = props.file.includes("dark") || light;
  const lockup = props.file.includes("lockup");
  const og = props.file.includes("-og.");

  return (
    <div
      className={cn(
        "grid min-h-[140px] w-full place-items-center",
        framed && "rounded-[28px] p-6",
        light && "bg-[#f4f4f4]",
        framed && !light && "bg-black",
        og && "min-h-[180px] rounded-[18px] bg-black p-0",
      )}
      role="img"
      aria-label={props.label}
    >
      {og ? (
        <img
          src={pressAssetHref(props.file)}
          alt={props.label}
          className="h-auto w-full rounded-[18px]"
        />
      ) : lockup ? (
        <span className="inline-flex items-center gap-3.5">
          <MascotMark name="Groxbot" color="#e45c9a" shape="circle" size="lg" />
          <span className="text-[28px] font-semibold tracking-[-0.02em]">
            Groxbot
          </span>
        </span>
      ) : (
        <MascotMark name="Groxbot" color="#e45c9a" shape="circle" size="lg" />
      )}
    </div>
  );
}

function CopyBlock(props: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <article className="grid gap-2.5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--card)] px-[18px] py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="kicker !m-0">{props.label}</p>
        <button
          type="button"
          className="btn ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(props.text);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="m-0 whitespace-pre-wrap font-[inherit] text-[15px] leading-relaxed">
        {props.text}
      </pre>
    </article>
  );
}
