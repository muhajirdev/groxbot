import { MascotMark } from "@groxbot/mascot";
import type { ReactNode } from "react";

export function OfficePreview() {
  return (
    <section className="preview-wrap" aria-label="Office preview">
      <div className="preview-window">
        <div className="window-bar" aria-hidden>
          <span className="traffic">
            <i className="close" />
            <i className="min" />
            <i className="max" />
          </span>
          <span className="window-title">Groxbot</span>
        </div>
        <div className="preview" aria-hidden>
          <aside className="preview-side">
            <div className="side-head">
              <div className="search-field">
                <SearchIcon />
                Search
              </div>
              <span className="plus-btn">
                <PlusIcon />
              </span>
            </div>
            <div className="conv-list">
              <PreviewRoom
                name="Ops"
                when="8:16"
                snip="Maya, You, Chief of Staff"
                on
              />
              <PreviewConv
                name="Inbox"
                when="7:02"
                snip="Five drafts parked for you"
                color="#d46b4a"
              />
              <PreviewConv
                name="Scout"
                when="11:47"
                snip="Shortlist is in the thread"
                color="#5b7cff"
              />
              <PreviewConv
                name="Ledger"
                when="8:16"
                snip="Flagged three receipts"
                color="#2f9e6d"
              />
              <PreviewConv
                name="Outbound"
                when="9:56"
                snip="Twelve drafts. Nothing sent."
                color="#e45c9a"
              />
            </div>
            <div className="side-foot">
              <div className="foot-item">
                <PlugIcon />
                Plugins
              </div>
              <div className="foot-item">
                <span
                  className="avatar sm circle"
                  style={{ background: "#4d5568" }}
                >
                  Y
                </span>
                You
              </div>
            </div>
          </aside>
          <div className="preview-thread">
            <div className="thread-head">
              <div className="thread-who">
                <span className="face-stack">
                  <span
                    className="avatar sm circle"
                    style={{ background: "#6b8afd" }}
                  >
                    M
                  </span>
                  <span
                    className="avatar sm circle"
                    style={{ background: "#4d5568" }}
                  >
                    Y
                  </span>
                  <MascotMark
                    name="Chief of Staff"
                    color="#c9a227"
                    shape="circle"
                    size="sm"
                    mood="working"
                  />
                </span>
                <span className="thread-who-copy">
                  Ops
                  <span>Maya, You, Chief of Staff</span>
                </span>
              </div>
              <div className="head-actions">
                <span className="icon-btn on">
                  <MonitorIcon />
                </span>
                <span className="icon-btn">
                  <GearIcon />
                </span>
              </div>
            </div>
            <div className="transcript">
              <div
                className="day-sep room-in"
                style={{ animationDelay: "0.35s" }}
              >
                This morning 8:16 AM
              </div>
              <div
                className="msg them room-in"
                style={{ animationDelay: "0.7s" }}
              >
                <span className="msg-who">Maya</span>
                <p className="bubble">
                  Chief of Staff — catch the rest of us up. I was in the vendor
                  call.
                </p>
              </div>
              <div
                className="msg me room-in"
                style={{ animationDelay: "1.25s" }}
              >
                <span className="msg-who">You</span>
                <p className="bubble human">
                  Same digest. Only this week’s priorities. Don’t send or move
                  meetings.
                </p>
              </div>
              <div
                className="msg them room-in"
                style={{ animationDelay: "2.05s" }}
              >
                <span className="msg-who">Chief of Staff</span>
                <p className="bubble bot">
                  Three decisions. Venue deposit, the Acme reply, and whether to
                  loop Scout. Rest can wait.
                </p>
              </div>
              <div
                className="computer-card app-card room-in"
                style={{ animationDelay: "2.55s" }}
              >
                <div className="computer-card-head">
                  Slides
                  <span className="status-pill">
                    <i /> Q3
                  </span>
                </div>
                <p className="computer-task">Morning digest deck</p>
                <div className="open-computer">Open</div>
              </div>
            </div>
            <div className="composer">
              <div className="composer-pill">Message Ops</div>
            </div>
          </div>
          <aside className="preview-pane">
            <div className="pane-head">Chief of Staff&apos;s screen</div>
            <p className="pane-label">Working</p>
            <div className="screen-box">
              <div className="desk-kicker">Workspace</div>
              /workspace
              <br />
              &nbsp;&nbsp;chief-of-staff.md
              <br />
              <br />
              Digest · since yesterday
              <br />• Venue deposit — you owe a yes
              <br />• Acme replied on pricing
              <br />• Scout’s shortlist is ready
              <br />
              Do not send. Do not move meetings.
              <br />
              <br />
              <div className="desk-kicker">Activity</div>
              editing digest.md
            </div>
            <div className="routines">Routines</div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function PreviewRoom(props: {
  name: string;
  when: string;
  snip: string;
  on?: boolean;
}) {
  return (
    <div className={`conv room${props.on ? " on" : ""}`}>
      <span className="face-stack">
        <span className="avatar sm circle" style={{ background: "#6b8afd" }}>
          M
        </span>
        <span className="avatar sm circle" style={{ background: "#4d5568" }}>
          Y
        </span>
        <MascotMark
          name="Chief of Staff"
          color="#c9a227"
          shape="circle"
          size="sm"
          mood={props.on ? "working" : "idle"}
        />
      </span>
      <span>
        <span className="conv-top">
          <span className="name">{props.name}</span>
          <span className="when">{props.when}</span>
        </span>
        <div className="snip">{props.snip}</div>
      </span>
    </div>
  );
}

function PreviewConv(props: {
  name: string;
  when: string;
  snip: string;
  color: string;
  on?: boolean;
}) {
  return (
    <div className={`conv${props.on ? " on" : ""}`}>
      <MascotMark
        name={props.name}
        color={props.color}
        shape="circle"
        mood={props.on ? "working" : "idle"}
      />
      <span>
        <span className="conv-top">
          <span className="name">{props.name}</span>
          <span className="when">{props.when}</span>
        </span>
        <div className="snip">{props.snip}</div>
      </span>
    </div>
  );
}

function Icon(props: { children: ReactNode }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <title>Icon</title>
      {props.children}
    </svg>
  );
}

function SearchIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Icon>
  );
}

function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

function PlugIcon() {
  return (
    <Icon>
      <path d="M9 7v4M15 7v4M8 11h8v3a4 4 0 0 1-8 0v-3Z" />
      <path d="M12 18v3" />
    </Icon>
  );
}

function MonitorIcon() {
  return (
    <Icon>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Icon>
  );
}

function GearIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
    </Icon>
  );
}
