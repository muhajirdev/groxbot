import { MascotMark } from "@groxbot/mascot";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  COMPARE,
  CONTACT_MAILTO,
  DEMOS,
  demoLogo,
  FAQS,
  HOME_ADOPTION,
  HOME_MODELS,
  SOURCE_REPO,
} from "../lib/copy";
import { HOME_INTEGRATIONS } from "../lib/teasers";
import { DemoThread } from "./DemoThread";
import { OfficePreview } from "./OfficePreview";
import { PersonFace } from "./PersonFace";
import { SiteChrome } from "./SiteChrome";

export function Landing(props: { startUrl: string }) {
  return (
    <SiteChrome startUrl={props.startUrl}>
      <main id="top">
        <section className="hero hero-home">
          <p className="hero-badge">Open source · Multiplayer</p>
          <h1 className="hero-title">
            <span>Meet</span>
            <MascotMark
              name="Groxbot"
              color="#e45c9a"
              shape="circle"
              size="md"
            />
            <span>Groxbot</span>
          </h1>
          <p className="lede">Like Grok Bot, for the whole team.</p>
          <p className="thesis">
            If OpenClaw is for your personal use, Groxbot is for the office.
          </p>
          <div className="row">
            <a className="btn lg" href={props.startUrl}>
              Get started
            </a>
          </div>
        </section>

        <OfficePreview />

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

        <section className="band versus-band" aria-label="Where Groxbot sits">
          <h2>One is solo. One is locked. This is the office.</h2>
          <div className="versus">
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
        </section>

        <section id="how" className="statement">
          <div className="statement-copy">
            <h2>Message Bots like teammates</h2>
            <p className="lede tight">
              Give work the way you would a coworker. Each Bot is a contact —
              name, optional job, one thread. They take the task, keep the
              context, and come back when they need approval.
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

        <section className="chapter">
          <h2>The whole team sits in the same office.</h2>
          <p className="lede">
            OpenClaw is one person and a laptop. Groxbot is named teammates, each
            with a computer, and a thread anyone on the team can open.
          </p>
        </section>

        <section className="tiles" aria-label="How the office works">
          <article className="tile">
            <h3>A computer you can ignore</h3>
            <p>
              Hire a teammate and they already have a computer. Open it from the
              thread. Work continues if you close the pane.
            </p>
            <div className="tile-stage">
              <div className="mini-pane">
                <div className="mini-pane-head">
                  Computer
                  <span className="status-pill">
                    <i /> Working
                  </span>
                </div>
                <p className="mini-pane-screen">
                  Files land here. You can leave this open or not.
                </p>
              </div>
            </div>
          </article>
          <article className="tile">
            <h3>Built into the bot</h3>
            <p>
              Not a second product and not a shared desk you pick at hire. Each
              Bot is one Durable Object. The computer is that actor’s workspace.
            </p>
            <div className="tile-stage">
              <div className="desk-split">
                <div className="desk-card on">
                  <span className="kicker">Bot</span>
                  <strong>Bot actor</strong>
                  <span>Named by botId</span>
                </div>
                <div className="desk-card">
                  <span className="kicker">Computer</span>
                  <strong>Workspace</strong>
                  <span>Already theirs</span>
                </div>
              </div>
            </div>
          </article>
          <article className="tile wide">
            <h3>Works from anywhere</h3>
            <p>
              Shut the laptop. Open the thread on your phone. The Bot’s computer
              lives in the cloud — not on your machine — so the work does not
              stop when you do.
            </p>
            <div className="tile-stage">
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
                    <p className="phone-bubble">
                      Queued the LinkedIn post. Still going.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="adopt" aria-label="Track AI adoption in your team">
          <div className="adopt-copy">
            <p className="kicker">Track AI adoption in your team</p>
            <h2>They won’t use it if nobody can see it.</h2>
            <p className="lede tight">
              A personal agent hides on a laptop. Who is putting Bots to work is
              on the board. That’s how the rest of the team starts.
            </p>
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

        <DemoShowcase />

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
              Keep the office on your machines. groxbot.com never sees the
              threads. The office still remembers — on your Postgres. Model
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
          <p className="kicker">Hire the first one</p>
          <h2>Hire your first Chief of Staff.</h2>
          <p className="lede tight">
            The job everyone starts with. Name it, open the thread, give it a
            real task — then hire specialists.
          </p>
          <a className="btn lg" href={props.startUrl}>
            Get started
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
          One message. LinkedIn, Instagram, Drive, Notion. Pick a demo.
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
