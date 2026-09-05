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
  HOME_KNOWLEDGE,
  HOME_MODELS,
  HERO_PITCH,
  SOURCE_REPO,
  THESES,
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
          <p className="lede hero-tagline">{HERO_PITCH}</p>
          <p className="thesis">
            Like Grok Bot, for the team. OpenClaw and Hermes are personal.
            Groxbot is the office.
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

        <section
          id="together"
          className="thesis-section"
          aria-labelledby="thesis-together"
        >
          <p className="kicker">{THESES[0].kicker}</p>
          <h2 id="thesis-together">{THESES[0].title}</h2>
          <p className="lede">{THESES[0].lede}</p>
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
          <p className="compare-more">
            <Link
              to="/compare/$slug"
              params={{
                slug: "grok-bot-vs-hermes-vs-openclaw-vs-paperclip",
              }}
            >
              Full comparison: Groxbot vs Hermes vs OpenClaw vs Paperclip
            </Link>
          </p>
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
              <p className="kicker">Office knowledge</p>
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

        <section className="tiles" aria-label="How the office works">
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
            Name it. Open the thread. Give it a real task.
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
