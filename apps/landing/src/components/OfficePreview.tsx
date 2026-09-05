import { MascotMark } from "@groxbot/mascot";
import type { ReactNode } from "react";
import { ComposerPlaceholder } from "./DemoThread";

const BOTS = [
  { name: "Chief of Staff", color: "#c9a227", when: "Now", on: true },
  { name: "Inbox", color: "#d46b4a", when: "7:02" },
  { name: "Scout", color: "#5b7cff", when: "11:47" },
  { name: "Ledger", color: "#2f9e6d", when: "8:16" },
  { name: "Outbound", color: "#e45c9a", when: "9:56" },
] as const;

const FILES = [
  { name: "notes", kind: "folder" as const, depth: 0, open: true },
  { name: "digest.md", kind: "file" as const, depth: 1, on: true },
  { name: "chief-of-staff.md", kind: "file" as const, depth: 0 },
  { name: "weekly.md", kind: "file" as const, depth: 0 },
];

export function OfficePreview() {
  return (
    <section className="preview-wrap" aria-label="Office preview">
      <div className="preview-shell">
        <div className="preview" aria-hidden>
          <aside className="preview-side">
            <div className="side-chrome">
              <div className="workspace-switch">
                Acme
                <ChevronDownIcon />
              </div>
              <span className="plus-btn">
                <PlusIcon />
              </span>
            </div>
            <div className="search-field">
              <SearchIcon />
              Search
              <kbd className="hotkey-kbd">⌘K</kbd>
            </div>
            <div className="conv-list">
              {BOTS.map((bot) => (
                <PreviewConv key={bot.name} {...bot} />
              ))}
            </div>
            <div className="side-foot">
              <nav className="preview-dock">
                <span className="preview-dock-item">
                  <KnowledgeIcon />
                  Knowledge
                </span>
                <span className="preview-dock-item">
                  <SkillsIcon />
                  Skills
                </span>
                <span className="preview-dock-item">
                  <AppsIcon />
                  Live apps
                </span>
                <span className="preview-dock-item">
                  <PlugIcon />
                  Plugins
                </span>
              </nav>
              <div className="you-row">
                <span className="avatar sm circle you-mark">Y</span>
                You
                <CaretSwapIcon />
              </div>
            </div>
          </aside>
          <div className="preview-thread">
            <div className="thread-head">
              <div className="thread-who">
                <MascotMark
                  name="Chief of Staff"
                  color="#c9a227"
                  shape="circle"
                  size="sm"
                  mood="working"
                />
                <strong>Chief of Staff</strong>
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
              <div className="day-sep room-in" style={{ animationDelay: "0.35s" }}>
                Today
              </div>
              <p
                className="bubble human room-in"
                style={{ animationDelay: "0.7s" }}
              >
                Catch me up. Only this week’s priorities. Don’t send or move
                meetings.
              </p>
              <p
                className="bubble bot room-in"
                style={{ animationDelay: "1.25s" }}
              >
                Three decisions. Venue deposit, the Acme reply, and whether to
                loop Scout. Rest can wait.
              </p>
              <div
                className="computer-card app-card room-in"
                style={{ animationDelay: "1.85s" }}
              >
                <div className="computer-card-head">Docs</div>
                <p className="computer-task">Morning digest</p>
                <div className="open-computer">Open</div>
              </div>
            </div>
            <ComposerPlaceholder name="Chief of Staff" />
          </div>
          <aside className="preview-pane">
            <div className="pane-head">
              <span className="pane-title">Chief of Staff&apos;s computer</span>
              <div className="head-actions">
                <span className="icon-btn">
                  <GearIcon />
                </span>
                <span className="icon-btn">
                  <CloseIcon />
                </span>
              </div>
            </div>
            <div className="pane-scroll">
              <div className="search-field explorer-search">
                <SearchIcon />
                Search...
              </div>
              <ul className="explorer-tree">
                {FILES.map((file) => (
                  <li
                    key={file.name}
                    className={`explorer-row${file.on ? " on" : ""}`}
                    style={{ paddingLeft: 6 + file.depth * 16 }}
                  >
                    {file.kind === "folder" ? (
                      <>
                        <span
                          className={`explorer-chevron${file.open ? "" : " closed"}`}
                        >
                          <ChevronDownIcon />
                        </span>
                        <FolderIcon />
                      </>
                    ) : (
                      <>
                        <span className="explorer-chevron" />
                        <FileIcon />
                      </>
                    )}
                    <span className="explorer-name">{file.name}</span>
                  </li>
                ))}
              </ul>
              <div className="routines">
                <p>
                  Recurring jobs this teammate runs on a schedule, even when
                  you are away.
                </p>
                <ul className="routine-list">
                  <li>
                    <div>
                      <strong>Morning digest</strong>
                      <span>every weekday at 09:00</span>
                    </div>
                  </li>
                </ul>
                <div className="create-routine">Create routine</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function PreviewConv(props: {
  name: string;
  when: string;
  color: string;
  on?: boolean;
}) {
  return (
    <div className={`conv${props.on ? " on" : ""}`}>
      <MascotMark
        name={props.name}
        color={props.color}
        shape="circle"
        size="sm"
        mood={props.on ? "working" : "idle"}
      />
      <span className="conv-copy">
        <span className="name">{props.name}</span>
        <span className="when">{props.when}</span>
      </span>
    </div>
  );
}

function Icon(props: { children: ReactNode; size?: number }) {
  const size = props.size ?? 16;
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
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
    <Icon size={18}>
      <path d="M9 7v4M15 7v4M8 11h8v3a4 4 0 0 1-8 0v-3Z" />
      <path d="M12 18v3" />
    </Icon>
  );
}

function KnowledgeIcon() {
  return (
    <Icon size={18}>
      <path d="M4 19V6.5A2.5 2.5 0 0 1 6.5 4H12v15H6.5A2.5 2.5 0 0 0 4 21.5" />
      <path d="M20 19V6.5A2.5 2.5 0 0 0 17.5 4H12v15h5.5A2.5 2.5 0 0 1 20 21.5" />
    </Icon>
  );
}

function SkillsIcon() {
  return (
    <Icon size={18}>
      <path d="M7 4h10v16l-5-3-5 3V4Z" />
    </Icon>
  );
}

function AppsIcon() {
  return (
    <Icon size={18}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
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

function CloseIcon() {
  return (
    <Icon>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

function ChevronDownIcon() {
  return (
    <Icon size={14}>
      <path d="M6 9l6 6 6-6" />
    </Icon>
  );
}

function CaretSwapIcon() {
  return (
    <Icon size={14}>
      <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
    </Icon>
  );
}

function FolderIcon() {
  return (
    <Icon size={16}>
      <path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </Icon>
  );
}

function FileIcon() {
  return (
    <Icon size={16}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6" />
    </Icon>
  );
}
