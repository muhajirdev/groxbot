import { MascotMark } from "@groxbot/mascot";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  COMPARE,
  COMPARE_CALLOUT,
  COMPARE_LINKS,
  CONTACT_MAILTO,
  DEMOS,
  demoLogo,
  FAQS,
  FOOTER_BLURB,
  HERO_DEMO,
  HERO_HEADLINE,
  HERO_PLATFORMS,
  TALK_DEMO,
  ADOPT_HEADLINE,
  ADOPT_POINTS,
  KNOW_HEADLINE,
  KNOW_POINTS,
  MEET_CHANNELS,
  MEET_HEADLINE,
  PHONE_HEADLINE,
  PHONE_LEDE,
  TALK_HEADLINE,
  TALK_POINTS,
  HOME_ADOPTION,
  HOME_MODELS,
  SOURCE_REPO,
  START_CTA,
  STORY,
  THESES,
} from "../lib/copy";
import { LANDING_HIRE_BOTS } from "../lib/bot-marketplace";
import { homeIntegrationMarquee } from "../lib/teasers";
import { DemoThread } from "./DemoThread";
import { HeroCompare } from "./HeroCompare";
import { HeroDemo } from "./HeroDemo";
import { KnowGraph } from "./KnowGraph";
import { PersonFace } from "./PersonFace";
import { SiteChrome } from "./SiteChrome";

export function Landing(props: { startUrl: string }) {
  return (
    <SiteChrome startUrl={props.startUrl}>
      <main id="top">
        <section className="hero hero-home">
          <p className="hero-badge">Invite only</p>
          <h1 aria-label={HERO_HEADLINE}>
            AI for <em>teams</em>
            <span className="hero-dot">.</span>
          </h1>
          <HeroCompare />
          <div className="row">
            <a className="btn lg" href={props.startUrl}>
              {START_CTA}
            </a>
            <a className="btn ghost" href="#demo">
              Watch the demo
            </a>
          </div>
          <p className="hero-platforms">
            <svg
              viewBox="0 0 16 16"
              width="16"
              height="16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3.2 8.2 6.4 11.4 12.8 4.6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Available for</span>
            {HERO_PLATFORMS.map((item) => (
              <span key={item.name} className="hero-platform">
                {"icon" in item ? (
                  <img src={item.icon} alt="" width={14} height={14} />
                ) : null}
                {item.name}
              </span>
            ))}
          </p>
          <HeroDemo demo={HERO_DEMO} id="demo" />
        </section>

        <section className="models-line" aria-label="Works with any model">
          <p>
            Works with any model — Claude Opus, Kimi, DeepSeek, GPT, Grok. Not
            locked in.
          </p>
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

        <section className="talk" aria-labelledby="talk-title">
          <div className="talk-copy">
            <h2 id="talk-title" aria-label={TALK_HEADLINE}>
              Invite your team
              <br />
              to talk with
              <br />
              your <em>AI agents</em>.
            </h2>
            <ul className="talk-points">
              {TALK_POINTS.map((item) => (
                <li key={item.icon}>
                  <TalkPointIcon name={item.icon} />
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
          <HeroDemo demo={TALK_DEMO} id="talk-demo" />
        </section>

        <section className="adopt-free" id="adopt" aria-labelledby="adopt-title">
          <h2 id="adopt-title" aria-label={ADOPT_HEADLINE}>
            Track your team&apos;s
            <br />
            <em>AI adoption</em>.
          </h2>
          <div className="adopt-free-body">
            <AdoptionBoard />
            <ul className="adopt-points">
              {ADOPT_POINTS.map((item) => (
                <li key={item.icon}>
                  <AdoptPointIcon name={item.icon} />
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="know" id="knowledge" aria-labelledby="know-title">
          <h2 id="know-title" aria-label={KNOW_HEADLINE}>
            A knowledge base
            <br />
            that <em>improves itself</em>.
          </h2>
          <div className="know-body">
            <KnowGraph />
            <ul className="know-points">
              {KNOW_POINTS.map((item) => (
                <li key={item.icon}>
                  <KnowPointIcon name={item.icon} />
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="talk" id="meet" aria-labelledby="meet-title">
          <div className="talk-copy">
            <h2 id="meet-title" aria-label={MEET_HEADLINE}>
              Meet your team
              <br />
              where they <em>work</em>.
            </h2>
          </div>
          <ul className="meet-apps">
            {MEET_CHANNELS.map((item) => (
              <li key={item.slug}>
                <img
                  src={demoLogo(item.slug)}
                  alt=""
                  width={36}
                  height={36}
                />
                {item.name}
              </li>
            ))}
          </ul>
        </section>

        <section
          className="phone-free"
          id="phone"
          aria-labelledby="phone-title"
        >
          <div className="phone-free-copy">
            <h2 id="phone-title" aria-label={PHONE_HEADLINE}>
              No <em>Mac Mini</em>
              <br />
              is required.
            </h2>
            <p className="meet-lede">{PHONE_LEDE}</p>
          </div>
          <HandoffScene />
        </section>

        <section className="story" aria-labelledby="story-title">
          <p className="kicker">How it works</p>
          <h2 id="story-title">Hire. Talk. They already have a computer.</h2>
          <ol className="story-beats">
            {STORY.map((beat, index) => (
              <li key={beat.id}>
                <p className="step">
                  {String(index + 1).padStart(2, "0")} · {beat.kicker}
                </p>
                <h3>{beat.title}</h3>
                <p>{beat.lede}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="together"
          className="thesis-section"
          aria-labelledby="thesis-together"
        >
          <p className="kicker">{THESES[0].kicker}</p>
          <h2 id="thesis-together">{THESES[0].title}</h2>
          <p className="lede">{THESES[0].lede}</p>
          <div className="versus versus-4">
            {COMPARE.map((item) => (
              <article
                key={item.name}
                className={`versus-col${item.ours ? " ours" : ""}`}
              >
                <p className="kicker">{item.kicker}</p>
                <h3>{item.name}</h3>
                <p>{item.line}</p>
              </article>
            ))}
          </div>
          <aside className="compare-callout" aria-label="Full comparison">
            <p className="kicker">{COMPARE_CALLOUT.kicker}</p>
            <h3>{COMPARE_CALLOUT.title}</h3>
            <p>{COMPARE_CALLOUT.lede}</p>
            <div className="compare-callout-actions">
              <Link
                className="btn"
                to="/compare/$slug"
                params={{ slug: COMPARE_LINKS[0].slug }}
              >
                Open full comparison
              </Link>
              <Link className="btn ghost" to="/compare">
                All matchups
              </Link>
            </div>
            <ul className="compare-chips">
              {COMPARE_LINKS.map((link) => (
                <li key={link.slug}>
                  <Link
                    to="/compare/$slug"
                    params={{ slug: link.slug }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        <section id="how" className="statement">
          <div className="statement-copy">
            <h2>Message Bots like teammates</h2>
            <p className="lede tight">
              Give work like a coworker. They come back when they need you.
            </p>
          </div>
          <div className="statement-face" aria-hidden>
            <MascotMark
              name="Groxbot"
              color="#e45c9a"
              shape="circle"
              size="lg"
            />
          </div>
        </section>

        <section className="tiles" aria-label="How it works">
          <article className="tile">
            <h3>A computer you can ignore</h3>
            <p>
              Hire a teammate. They already have a computer. Leave the pane
              open, or don’t.
            </p>
            <div className="tile-stage">
              <div className="mini-pane">
                <div className="mini-pane-head">
                  Chief of Staff&apos;s computer
                  <span className="status-pill">
                    <i /> Working
                  </span>
                </div>
                <p className="mini-pane-screen">
                  notes/digest.md
                  <br />
                  chief-of-staff.md
                  <br />
                  weekly.md
                </p>
              </div>
            </div>
          </article>
          <article className="tile">
            <h3>Built into the bot</h3>
            <p>Not a second product. The computer is built in.</p>
            <div className="tile-stage">
              <div className="desk-split">
                <div className="desk-card on">
                  <span className="kicker">Bot</span>
                  <strong>Chief of Staff</strong>
                  <span>Named teammate</span>
                </div>
                <div className="desk-card">
                  <span className="kicker">Computer</span>
                  <strong>Their screen</strong>
                  <span>Already theirs</span>
                </div>
              </div>
            </div>
          </article>
        </section>

        <DemoShowcase />

        <section
          id="hire"
          className="band catalog"
          aria-labelledby="hire-catalog"
        >
          <p className="kicker">Hire catalog</p>
          <h2 id="hire-catalog">Bots you can hire today.</h2>
          <p className="lede tight">
            Each listing is a full teammate package — soul, starter memory, and
            playbook skills. Same catalog as New bot. Not plugins.
          </p>
          <div className="cards hire-catalog-cards">
            {LANDING_HIRE_BOTS.slice(0, 9).map((bot) => (
              <article key={bot.id} className="card">
                <p className="kicker">{bot.category}</p>
                <h3>
                  <Link
                    className="no-underline hover:underline"
                    to="/templates/$slug"
                    params={{ slug: bot.id }}
                  >
                    {bot.name}
                  </Link>
                </h3>
                {bot.kind === "person" && bot.title ? (
                  <p className="hire-catalog-title">{bot.title}</p>
                ) : null}
                <p className="hire-catalog-blurb">{bot.blurb}</p>
                <p className="hire-catalog-meta">
                  Soul · memory · {bot.skills.length} skill
                  {bot.skills.length === 1 ? "" : "s"}
                </p>
                <ul className="hire-catalog-skills">
                  {bot.skills.map((skill) => (
                    <li key={skill.slug}>{skill.name}</li>
                  ))}
                </ul>
                <a className="btn ghost hire-catalog-cta" href={props.startUrl}>
                  Hire {bot.name}
                </a>
              </article>
            ))}
          </div>
          <div className="row mt-4">
            <Link className="btn ghost" to="/templates">
              All templates
            </Link>
            <Link className="btn ghost" to="/use-cases">
              All use cases
            </Link>
            <Link className="btn ghost" to="/pricing">
              Pricing
            </Link>
          </div>
        </section>

        <section
          className="band catalog home-integrations"
          id="integrations"
          aria-labelledby="integrations-title"
        >
          <p className="kicker">Integrations</p>
          <h2 id="integrations-title">Your tools. In the thread.</h2>
          <p className="lede tight">
            1,000+ tools. LinkedIn, Slack, Notion, GitHub — and a computer for
            the indie stack.
          </p>
          <HomeIntegrationMarquee />
          <Link className="home-integrations-more" to="/integrations">
            Browse all integrations
          </Link>
        </section>

        <section
          id="enterprise"
          className="enterprise"
          aria-label="Enterprise ready"
        >
          <div className="enterprise-copy">
            <p className="kicker">Self-host</p>
            <h2>Enterprise ready.</h2>
            <p className="lede tight">
              Keep Whip Computer on your machines. whip.computer never sees the
              threads. It still remembers — on your SQLite catalog. Model
              calls go to the key you paste.
            </p>
            <div className="row">
              <a className="btn ghost" href={CONTACT_MAILTO}>
                Email
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

        <section id="faq" className="band faq-band">
          <h2>FAQs</h2>
          <div className="faqs">
            {FAQS.map((item) => (
              <details key={item.q} className="faq">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="cta">
          <p className="kicker">Invite only</p>
          <h2>{FOOTER_BLURB}</h2>
          <p className="lede tight">
            Whip Computer isn’t open signup yet. Email us and we’ll get you in.
          </p>
          <a className="btn lg" href={props.startUrl}>
            {START_CTA}
          </a>
        </section>
      </main>
    </SiteChrome>
  );
}

function DemoShowcase() {
  const [active, setActive] = useState<(typeof DEMOS)[number]>(DEMOS[0]!);

  return (
    <section id="jobs" className="demo" aria-label="Integration demos">
      <div className="demo-copy">
        <h2>Watch a Bot actually do the work.</h2>
        <p className="lede tight">
          One message. LinkedIn, Instagram, Drive, Notion.
        </p>
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
                <em>{demo.toolLine}</em>
              </span>
            </button>
          ))}
        </div>
      </div>
      <DemoThread demo={active} />
    </section>
  );
}

function AdoptionBoard() {
  const lead = HOME_ADOPTION[0]?.tasks ?? 1;
  return (
    <ol className="board">
      {HOME_ADOPTION.map((person, index) => {
        const width = Math.round((person.tasks / lead) * 100);
        return (
          <li
            key={person.name}
            className={index === 0 ? "lead" : undefined}
          >
            <span className="rank">{index + 1}</span>
            <PersonFace src={person.photo} name={person.name} size="md" />
            <span className="board-who">
              <strong>{person.name}</strong>
              <em>{person.role}</em>
            </span>
            <span className="board-bar" aria-hidden>
              <i style={{ width: `${width}%` }} />
            </span>
            <span className="board-n">
              {person.label}
              <em>tasks</em>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function AdoptPointIcon(props: { name: (typeof ADOPT_POINTS)[number]["icon"] }) {
  const draw =
    props.name === "people"
      ? "M9.2 9.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8zM4.8 19c.3-2.8 2.1-4.4 4.4-4.4s4.1 1.6 4.4 4.4M16.4 10.2a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8zM14.2 19c.2-1.8 1.1-3 2.4-3.4"
      : props.name === "heat"
        ? "M6 16.8h2.2V19H6zM10.2 13.2H12.4V19H10.2zM14.4 9.2H16.6V19H14.4zM6 10.4 10.6 6l4 3.2L18.8 5.6"
        : "M7 7.2h10.4v9.6H7zM9.2 10.2h6M9.2 13h4.4";

  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={draw}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIntegrationMarquee() {
  const { rows } = homeIntegrationMarquee();
  return (
    <div className="int-marquee" aria-hidden="true">
      {rows.map((row, index) => (
        <div
          key={index === 0 ? "fwd" : "rev"}
          className={index === 0 ? "int-marquee-row" : "int-marquee-row rev"}
        >
          <div className="int-marquee-track">
            {[0, 1].map((copy) => (
              <ul key={copy}>
                {row.map((item) => (
                  <li key={`${copy}-${item.slug}`}>
                    <span className="chip has-icon">
                      <img
                        className="chip-logo"
                        src={item.logo}
                        alt=""
                        width={18}
                        height={18}
                        decoding="async"
                      />
                      {item.name}
                    </span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HandoffScene() {
  return (
    <div className="handoff-scene" aria-hidden>
      <div className="device laptop">
        <div className="laptop-screen">Lid closed</div>
        <div className="laptop-base" />
        <span>Your laptop</span>
      </div>
      <div className="device cloud">
        <MascotMark
          name="Groxbot"
          color="#e45c9a"
          shape="circle"
          size="md"
          mood="working"
        />
        <span className="status-pill">
          <i /> Working
        </span>
        <span>Cloud computer</span>
      </div>
      <div className="device phone">
        <div className="phone-notch" />
        <div className="phone-screen">
          <div className="phone-head">
            <MascotMark
              name="Outbound"
              color="#5b7cff"
              shape="circle"
              size="xs"
              mood="working"
            />
            Outbound
          </div>
          <p className="phone-typing">
            <i />
            <i />
            <i />
          </p>
          <p className="phone-bubble">Queued the LinkedIn post. Still going.</p>
        </div>
      </div>
    </div>
  );
}

function KnowPointIcon(props: { name: (typeof KNOW_POINTS)[number]["icon"] }) {
  const draw =
    props.name === "file"
      ? "M7 4.5h7.2L19 9.2V19.5H7zM14.2 4.5V9.2H19M9.2 12.5h5.6M9.2 15.6h4.2"
      : props.name === "loop"
        ? "M7.2 8.2A5.2 5.2 0 0 1 16.8 9.4M16.8 15.8A5.2 5.2 0 0 1 7.2 14.6M16.8 9.4l1.6-2.6M16.8 9.4l-2.5.4M7.2 14.6l-1.6 2.6M7.2 14.6l2.5-.4"
        : "M8.8 8.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8zM4.4 18.6c.3-2.6 2-4.2 4.4-4.2s4.1 1.6 4.4 4.2M15.2 9.8 19 8.4 15.2 7M19 8.4v3.2";

  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={draw}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TalkPointIcon(props: { name: (typeof TALK_POINTS)[number]["icon"] }) {
  const draw =
    props.name === "build"
      ? "M14.8 6.2a3.8 3.8 0 0 0-5.4 5.3L4 16.9 7.1 20l5.4-5.4a3.8 3.8 0 0 0 5.3-5.4l-2.4 2.3-2.2-2.2z"
      : props.name === "team"
        ? "M9 8.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM4.2 18.8c.4-3 2.4-4.7 4.8-4.7s4.4 1.7 4.8 4.7M16.8 9.4a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2zM16.2 18.8c.3-2.2 1.6-3.5 3.6-3.8"
        : "M4.5 16.2 9 11.6l3.1 3.1 7.4-7.4";

  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={draw}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
