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
  TALK_HEADLINE,
  TALK_LEDE,
  HOME_ADOPTION,
  HOME_KNOWLEDGE,
  HOME_MODELS,
  SOURCE_REPO,
  START_CTA,
  STORY,
  THESES,
} from "../lib/copy";
import { LANDING_HIRE_BOTS } from "../lib/bot-marketplace";
import { HOME_INTEGRATIONS } from "../lib/teasers";
import { DemoThread } from "./DemoThread";
import { HeroCompare } from "./HeroCompare";
import { HeroDemo } from "./HeroDemo";
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
            {HERO_PLATFORMS.map((name) => (
              <span key={name} className="hero-platform">
                {name}
              </span>
            ))}
          </p>
          <HeroDemo demo={HERO_DEMO} id="demo" />
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
            <p className="talk-lede">{TALK_LEDE}</p>
          </div>
          <HeroDemo demo={TALK_DEMO} id="talk-demo" />
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

        <section id="adopt" className="adopt" aria-labelledby="thesis-adopt">
          <div className="adopt-copy">
            <p className="kicker">{THESES[1].kicker}</p>
            <h2 id="thesis-adopt">{THESES[1].title}</h2>
            <p className="lede tight">{THESES[1].lede}</p>
          </div>
          <ol className="board">
            {HOME_ADOPTION.map((person, index) => {
              const lead = HOME_ADOPTION[0]!.tasks;
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
        </section>

        <section
          id="knowledge"
          className="adopt"
          aria-labelledby="thesis-knowledge"
        >
          <div className="adopt-copy">
            <p className="kicker">{THESES[2].kicker}</p>
            <h2 id="thesis-knowledge">{THESES[2].title}</h2>
            <p className="lede tight">{THESES[2].lede}</p>
          </div>
          <div className="know-loop" aria-hidden>
            <div className="know-col">
              <p className="kicker">Thread</p>
              {HOME_KNOWLEDGE.thread.map((line) => (
                <p key={line} className="know-line">
                  {line}
                </p>
              ))}
            </div>
            <div className="know-col on">
              <p className="kicker">Shared knowledge</p>
              {HOME_KNOWLEDGE.files.map((file) => (
                <p key={file.path} className="know-file">
                  <strong>{file.path}</strong>
                  {file.note}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section id="phone" className="thesis-section" aria-labelledby="thesis-phone">
          <p className="kicker">{THESES[3].kicker}</p>
          <h2 id="thesis-phone">{THESES[3].title}</h2>
          <p className="lede">{THESES[3].lede}</p>
          <div className="thesis-proof">
            <HandoffScene />
          </div>
          <p className="kicker why">Why it matters</p>
          <p className="thesis-why">{THESES[3].why}</p>
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

        <section className="band catalog">
          <p className="kicker">Integrations</p>
          <h2>Your tools. In the thread.</h2>
          <p className="lede tight">
            LinkedIn, Instagram, Google Drive, Notion — plus Gmail, Slack, and
            GitHub. A computer for the indie stack.
          </p>
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
            <Link className="chip chip-all" to="/integrations">
              All integrations
            </Link>
          </div>
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
