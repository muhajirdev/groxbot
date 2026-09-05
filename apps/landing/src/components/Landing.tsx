import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  DEMOS,
  demoLogo,
  HOME_FEATURES,
  HOME_FAQS,
  HOME_MODELS,
  SOURCE_REPO,
  TAGLINE,
} from "../lib/copy";
import { HOME_INTEGRATIONS } from "../lib/teasers";
import { DemoThread } from "./DemoThread";
import { OfficePreview } from "./OfficePreview";
import { SiteChrome } from "./SiteChrome";

export function Landing(props: { startUrl: string }) {
  return (
    <SiteChrome startUrl={props.startUrl}>
      <main id="top">
        <section className="home-hero" aria-labelledby="home-title">
          <h1 id="home-title">{TAGLINE}.</h1>
          <p className="home-hero-lede">
            Named teammates with computers — the office for your team, not one
            laptop. Open source. Self-host free.
          </p>
          <div className="row">
            <a className="btn lg" href={props.startUrl}>
              Get started
            </a>
          </div>
          <OfficePreview />
        </section>

        <section className="home-strip" aria-label="Works with any model">
          <p>Works with any model — not locked to one vendor.</p>
          <ul className="model-marks">
            {HOME_MODELS.map((model) => (
              <li key={model.name}>
                <img
                  className={`model-icon ${model.tone}`}
                  src={model.icon}
                  alt=""
                  width={18}
                  height={18}
                />
                {model.name}
              </li>
            ))}
          </ul>
        </section>

        <section
          id="features"
          className="home-section"
          aria-labelledby="features-title"
        >
          <div className="home-section-head">
            <h2 id="features-title">The office, not another personal agent</h2>
            <p className="lede tight">
              Like Grok Bot, for the team. OpenClaw and Hermes are personal.
              Groxbot is where everyone works.
            </p>
          </div>
          <div className="cards">
            {HOME_FEATURES.map((feature) => (
              <article key={feature.title} className="card">
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <DemoShowcase />

        <section
          id="integrations"
          className="home-section home-integrations"
          aria-labelledby="integrations-title"
        >
          <div className="home-section-head">
            <h2 id="integrations-title">Your tools. In the thread.</h2>
            <p className="lede tight">
              LinkedIn, Drive, Notion, Slack, GitHub — grant access when they
              hit a wall.
            </p>
          </div>
          <div className="chips">
            {HOME_INTEGRATIONS.map((item) => (
              <Link
                key={item.slug}
                className="chip has-icon"
                to="/integrations/$slug"
                params={{ slug: item.slug }}
              >
                <img
                  className="chip-logo"
                  src={demoLogo(item.slug)}
                  alt=""
                  width={18}
                  height={18}
                  decoding="async"
                />
                {item.name}
              </Link>
            ))}
          </div>
          <Link className="home-integrations-more" to="/integrations">
            All integrations
          </Link>
        </section>

        <section id="faq" className="home-section home-faq" aria-labelledby="faq-title">
          <h2 id="faq-title">Questions</h2>
          <div className="faqs">
            {HOME_FAQS.map((item) => (
              <details key={item.q} className="faq">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="home-cta" aria-labelledby="cta-title">
          <h2 id="cta-title">Hire your first teammate.</h2>
          <p className="lede tight">
            Name it. Open the thread. Give it a real task.
          </p>
          <div className="row">
            <a className="btn lg" href={props.startUrl}>
              Get started
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
          <p className="home-cta-note">
            Self-host for free. Fair-code on GitHub.
          </p>
        </section>
      </main>
    </SiteChrome>
  );
}

function DemoShowcase() {
  const [active, setActive] = useState<(typeof DEMOS)[number]>(DEMOS[0]!);

  return (
    <section
      id="demo"
      className="home-section demo"
      aria-label="Integration demos"
    >
      <div className="home-section-head">
        <h2>Watch a bot do the work.</h2>
        <p className="lede tight">One message. Real tools. Nothing live until you look.</p>
      </div>
      <div className="demo-layout">
        <div className="demo-list">
          {DEMOS.map((demo) => (
            <button
              key={demo.id}
              type="button"
              className={`demo-pick${demo.id === active.id ? " on" : ""}`}
              aria-pressed={demo.id === active.id}
              onClick={() => setActive(demo)}
            >
              <span className="demo-pick-logos" aria-hidden>
                {demo.slugs.map((slug) => (
                  <img
                    key={slug}
                    className="demo-logo"
                    src={demoLogo(slug)}
                    alt=""
                    width={20}
                    height={20}
                  />
                ))}
              </span>
              <span className="demo-pick-text">
                <strong>{demo.title}</strong>
                <span>{demo.blurb}</span>
              </span>
            </button>
          ))}
        </div>
        <DemoThread demo={active} />
      </div>
    </section>
  );
}
