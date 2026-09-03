import {
  ArrowUpIcon,
  CaretDownIcon,
  CheckIcon,
  SquareIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { MASCOT_MOODS, type MascotMood } from "@groxbot/mascot";
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from "../components/assistant-ui/elements/reasoning";
import {
  SpiralLoader,
  ThinkingStatus,
} from "../components/assistant-ui/elements/spiral-loader";
import { TooltipIconButton } from "../components/assistant-ui/elements/tooltip-icon-button";
import { AvatarMark } from "../components/Avatar";
import { PersonAvatar } from "../components/PersonAvatar";
import { AppCard } from "../components/AppCard";
import { ChatMarkdown } from "../components/ChatMarkdown";
import { KnowledgeGraphMap } from "../components/KnowledgeGraph";
import { TypingDots } from "../components/TypingDots";
import { Skeleton } from "../components/ui/skeleton";
import { AVATAR_COLORS, AVATAR_SHAPES, SUGGESTED_JOBS } from "../lib/jobs";
import { applyTheme, readTheme, type Theme } from "../lib/theme";
import { Button, Chip, cn, Field, Input, Textarea } from "../ui";

const SECTIONS = [
  { id: "thinking", label: "Thinking" },
  { id: "reasoning", label: "Reasoning" },
  { id: "tools", label: "Tools" },
  { id: "mascot", label: "Mascot" },
  { id: "thread", label: "Thread" },
  { id: "composer", label: "Composer" },
  { id: "status", label: "Status" },
  { id: "controls", label: "Controls" },
  { id: "color", label: "Color" },
  { id: "knowledge", label: "Knowledge" },
] as const;

const TOKENS = [
  "--bg",
  "--bg-side",
  "--bg-thread",
  "--bg-pane",
  "--ink",
  "--muted",
  "--line",
  "--card",
  "--card-2",
  "--hover",
  "--selected",
  "--accent",
  "--ok",
  "--danger",
] as const;

const GRAPH_PATHS = [
  "playbooks/handoff.md",
  "notes/clients.md",
  "sources/brief.md",
  "playbooks/SKILL.md",
  "notes/ghost.md",
];
const GRAPH_OUT = [[1, 3], [0, 2], [1], [0], [0]];
const GRAPH_FILES = new Set(
  GRAPH_PATHS.filter((path) => path !== "notes/ghost.md"),
);

const THOUGHT =
  "The brief asks for a shortlist, not outreach. I’ll stay in the office notes, skip email, and stop with names plus why.";

export function Design() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [graph, setGraph] = useState<string | null>("playbooks/handoff.md");
  const [job, setJob] = useState<string>(SUGGESTED_JOBS[0]?.title ?? "");

  return (
    <div className="design-page">
      <header className="design-head">
        <div className="design-brand">
          <p className="kicker">Groxbot</p>
          <h1>Design</h1>
          <p className="hint">
            Live pieces from the office. Flip theme and watch thinking, working,
            and idle in place.
          </p>
        </div>
        <div className="design-head-actions">
          <div className="row tight">
            {(["system", "dark", "light"] as const).map((value) => (
              <Chip
                key={value}
                selected={theme === value}
                onClick={() => {
                  setTheme(value);
                  applyTheme(value);
                }}
              >
                {value === "system" ? "System" : value === "dark" ? "Dark" : "Light"}
              </Chip>
            ))}
          </div>
          <Link to="/" className="btn ghost tiny">
            Back
          </Link>
        </div>
      </header>

      <div className="design-body">
        <nav className="design-toc" aria-label="Sections">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.label}
            </a>
          ))}
        </nav>

        <main className="design-main">
          <Section
            id="thinking"
            title="Thinking"
            lede="What the thread shows while a turn is in flight — before text, during tools, after send."
          >
            <Specimen label="Waiting for the assistant" hint="ThinkingStatus">
              <ThinkingStatus name="Chief" />
            </Specimen>
            <Specimen label="Spiral" hint="14 · 16 · 24 · 40">
              <div className="design-row">
                {[14, 16, 24, 40].map((size) => (
                  <span key={size} className="design-spiral">
                    <SpiralLoader size={size} />
                    <span className="hint">{size}</span>
                  </span>
                ))}
              </div>
            </Specimen>
            <Specimen label="Typing dots" hint="legacy bubble">
              <TypingDots label="Working" />
            </Specimen>
            <Specimen label="History skeleton" hint="thread still loading">
              <ThreadHistorySkeleton />
            </Specimen>
          </Section>

          <Section
            id="reasoning"
            title="Reasoning"
            lede="The disclosure next to the spiral. Streaming holds the panel open; done collapses to Thought."
          >
            <Specimen label="Streaming" hint="active shimmer">
              <ReasoningRoot variant="ghost" streaming defaultOpen>
                <ReasoningTrigger active />
                <ReasoningContent aria-busy>
                  <ReasoningText>{THOUGHT}</ReasoningText>
                </ReasoningContent>
              </ReasoningRoot>
            </Specimen>
            <Specimen label="Done" hint="Thought + duration">
              <ReasoningRoot variant="ghost" defaultOpen>
                <ReasoningTrigger duration={4} />
                <ReasoningContent>
                  <ReasoningText>{THOUGHT}</ReasoningText>
                </ReasoningContent>
              </ReasoningRoot>
            </Specimen>
            <Specimen label="Collapsed">
              <ReasoningRoot variant="ghost">
                <ReasoningTrigger duration={4} />
                <ReasoningContent>
                  <ReasoningText>{THOUGHT}</ReasoningText>
                </ReasoningContent>
              </ReasoningRoot>
            </Specimen>
          </Section>

          <Section
            id="tools"
            title="Tools"
            lede="Same spiral while a call runs. Check, warning, and strike-through after."
          >
            <Specimen label="Running">
              <ToolRow toolName="read_file" status="running" />
            </Specimen>
            <Specimen label="Complete">
              <ToolRow toolName="read_file" status="complete" />
            </Specimen>
            <Specimen label="Needs approval">
              <ToolRow toolName="send_email" status="requires-action" />
            </Specimen>
            <Specimen label="Failed">
              <ToolRow toolName="browser" status="incomplete" />
            </Specimen>
            <Specimen label="Cancelled">
              <ToolRow toolName="write_file" status="cancelled" />
            </Specimen>
            <Specimen label="Group" hint="3 tool calls">
              <ToolGroupRow count={3} active />
              <ToolGroupRow count={3} />
            </Specimen>
          </Section>

          <Section
            id="mascot"
            title="Mascot"
            lede="Shape and mood morph. Sidebar uses working while the bot is busy."
          >
            <Specimen label="Moods" hint="idle · thinking · working · happy">
              <div className="design-mascot-grid">
                {MASCOT_MOODS.map((mood) => (
                  <figure key={mood} className="design-mascot">
                    <AvatarMark
                      name="Chief"
                      color="#e45c9a"
                      shape="circle"
                      size="lg"
                      mood={mood}
                      hero
                    />
                    <figcaption>{mood}</figcaption>
                  </figure>
                ))}
              </div>
            </Specimen>
            <Specimen label="Shapes" hint="onboarding picks">
              <div className="design-mascot-grid sm">
                {AVATAR_SHAPES.map((shape) => (
                  <figure key={shape} className="design-mascot">
                    <AvatarMark
                      name={shape}
                      color="#5b7cff"
                      shape={shape}
                      size="md"
                      mood="idle"
                    />
                    <figcaption>{shape}</figcaption>
                  </figure>
                ))}
              </div>
            </Specimen>
            <Specimen label="Colors">
              <div className="design-row wrap">
                {AVATAR_COLORS.map((color) => (
                  <AvatarMark
                    key={color}
                    name={color}
                    color={color}
                    shape="circle"
                    size="md"
                    mood="happy"
                  />
                ))}
              </div>
            </Specimen>
          </Section>

          <Section
            id="thread"
            title="Thread"
            lede="Bubbles, cards, and the sidebar row that bounces while a bot is working."
          >
            <Specimen label="Messages">
              <div className="design-thread">
                <div className="my-2.5 mb-1 text-center text-xs text-muted">
                  Today
                </div>
                <div className="ml-auto max-w-[72%]">
                  <div className="mb-1.5 flex flex-row-reverse items-center gap-1.5">
                    <PersonAvatar name="Alex" size="xs" />
                    <span className="text-[12px] font-medium text-ink/80">
                      You
                    </span>
                  </div>
                  <div className="rounded-[18px] border border-[#2a2a2a] bg-[#1a1a1a] px-3.5 py-2.5 text-[15px] leading-snug light:border-line light:bg-white">
                    <ChatMarkdown text="Source a shortlist from the brief. Don’t email anyone." />
                  </div>
                </div>
                <div className="mr-auto max-w-[72%] rounded-[18px] bg-[#141414] px-3.5 py-2.5 text-[15px] leading-snug light:bg-[#ececec]">
                  <ChatMarkdown text="I’ll stay in the notes and stop with names plus why." />
                </div>
                <ThinkingStatus name="Chief" />
              </div>
            </Specimen>
            <Specimen label="App card">
              <AppCard
                templateId="docs"
                title="Shortlist"
                onOpen={() => undefined}
              />
            </Specimen>
            <Specimen label="Sidebar rows">
              <div className="design-sidebar">
                <BotRow
                  name="Chief"
                  title="Turn messy notes into decisions"
                  color="#e45c9a"
                  mood="working"
                  selected
                  time="Now"
                />
                <BotRow
                  name="Talent Scout"
                  title="Source candidates from the brief"
                  color="#5b7cff"
                  mood="idle"
                  time="11:47"
                />
                <BotRow
                  name="Lookout"
                  title="Unread result"
                  color="#d9a441"
                  mood="happy"
                  time="Yesterday"
                />
              </div>
            </Specimen>
          </Section>

          <Section
            id="composer"
            title="Composer"
            lede="Send while idle. Square stop while a turn is running."
          >
            <Specimen label="Idle">
              <ComposerMock running={false} />
            </Specimen>
            <Specimen label="Running">
              <ComposerMock running />
            </Specimen>
            <Specimen label="Follow-ups">
              <div className="flex flex-wrap gap-2">
                {["Draft the shortlist", "Stay in notes", "Ask before email"].map(
                  (prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="rounded-full border border-line bg-background px-3 py-1 text-sm"
                    >
                      {prompt}
                    </button>
                  ),
                )}
              </div>
            </Specimen>
          </Section>

          <Section
            id="status"
            title="Status"
            lede="Pills on computer cards and gate devices. Ok vs in-flight."
          >
            <Specimen label="Pills">
              <div className="design-row wrap">
                <span className="status-pill">
                  <i /> Working
                </span>
                <span className="status-pill done">
                  <i /> Done
                </span>
                <span className="ok">Saved</span>
                <span className="error">Couldn’t send</span>
              </div>
            </Specimen>
            <Specimen label="Computer card">
              <div className="computer-card">
                <div className="computer-card-head">
                  <span>Computer</span>
                  <span className="status-pill">
                    <i /> Working
                  </span>
                </div>
                <p className="computer-task">Reading the brief</p>
              </div>
            </Specimen>
          </Section>

          <Section id="controls" title="Controls">
            <Specimen label="Buttons">
              <div className="design-row wrap">
                <Button>Solid</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="text">Text</Button>
                <Button variant="mini">Stop now</Button>
                <Button disabled>Disabled</Button>
                <button type="button" className="btn">
                  Pill
                </button>
                <button type="button" className="btn ghost">
                  Pill ghost
                </button>
              </div>
            </Specimen>
            <Specimen label="Job chips">
              <div className="row wrap">
                {SUGGESTED_JOBS.map((item) => (
                  <Chip
                    key={item.title}
                    selected={job === item.title}
                    onClick={() => setJob(item.title)}
                  >
                    {item.title}
                  </Chip>
                ))}
              </div>
            </Specimen>
            <Specimen label="Fields">
              <Field label="Name">
                <Input defaultValue="Chief" />
              </Field>
              <Field label="Handoff" hint="Outcome, sources, when to stop.">
                <Textarea defaultValue={SUGGESTED_JOBS[0]?.description} rows={3} />
              </Field>
            </Specimen>
          </Section>

          <Section id="color" title="Color" lede="Tokens on the current theme.">
            <Specimen label="Swatches">
              <div className="design-swatches">
                {TOKENS.map((token) => (
                  <figure key={token} className="design-swatch">
                    <span style={{ background: `var(${token})` }} />
                    <figcaption>{token}</figcaption>
                  </figure>
                ))}
              </div>
            </Specimen>
          </Section>

          <Section
            id="knowledge"
            title="Knowledge"
            lede="One GET, inverted in the client. Missing files stay as hollow nodes."
          >
            <Specimen label="Graph" hint="click a node">
              <div className="design-graph">
                <KnowledgeGraphMap
                  paths={GRAPH_PATHS}
                  out={GRAPH_OUT}
                  selected={graph}
                  files={GRAPH_FILES}
                  onSelect={setGraph}
                  onOpen={setGraph}
                />
              </div>
            </Specimen>
          </Section>
        </main>
      </div>
    </div>
  );
}

function Section(props: {
  id: string;
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <section id={props.id} className="design-section">
      <h2>{props.title}</h2>
      {props.lede ? <p className="lede">{props.lede}</p> : null}
      <div className="design-grid">{props.children}</div>
    </section>
  );
}

function Specimen(props: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <figure className="design-specimen">
      <figcaption>
        <span>{props.label}</span>
        {props.hint ? <span className="hint">{props.hint}</span> : null}
      </figcaption>
      <div className="design-canvas">{props.children}</div>
    </figure>
  );
}

function ThreadHistorySkeleton() {
  return (
    <div
      role="status"
      className="flex flex-col gap-y-6"
      aria-label="Loading conversation"
    >
      <Skeleton className="ml-auto h-9 w-2/5 rounded-xl motion-reduce:animate-none" />
      <div className="flex flex-col gap-y-2">
        <Skeleton className="h-4 w-11/12 motion-reduce:animate-none" />
        <Skeleton className="h-4 w-4/5 motion-reduce:animate-none" />
        <Skeleton className="h-4 w-3/5 motion-reduce:animate-none" />
      </div>
    </div>
  );
}

function ToolRow(props: {
  toolName: string;
  status: "running" | "complete" | "incomplete" | "requires-action" | "cancelled";
}) {
  const running = props.status === "running";
  const cancelled = props.status === "cancelled";
  const Icon =
    running || cancelled
      ? null
      : props.status === "complete"
        ? CheckIcon
        : props.status === "requires-action"
          ? WarningCircleIcon
          : XCircleIcon;
  const label = cancelled ? "Cancelled tool" : "Used tool";

  return (
    <div className="flex w-fit origin-left items-center gap-2 py-1.5 text-sm text-muted-foreground">
      {running ? (
        <SpiralLoader size={16} />
      ) : cancelled ? (
        <XCircleIcon className="size-4 shrink-0 text-muted-foreground" />
      ) : Icon ? (
        <Icon className="size-4 shrink-0" />
      ) : null}
      <span
        className={cn(
          "inline-block text-start leading-none",
          cancelled && "text-muted-foreground line-through",
          running && "shimmer motion-reduce:animate-none",
        )}
      >
        {label}: <b>{props.toolName}</b>
      </span>
      {running ? null : (
        <span className="text-muted-foreground text-xs tabular-nums">1.2s</span>
      )}
      <CaretDownIcon className="size-4 shrink-0 -rotate-90 opacity-50" />
    </div>
  );
}

function ToolGroupRow(props: { count: number; active?: boolean }) {
  return (
    <div className="flex origin-left items-center gap-2 py-1.5 text-sm text-muted-foreground">
      {props.active ? <SpiralLoader size={12} /> : null}
      <span
        className={cn(
          "inline-block text-start text-xs leading-none",
          props.active && "shimmer motion-reduce:animate-none",
        )}
      >
        {props.count} tool calls
      </span>
      <CaretDownIcon className="size-3 shrink-0 -rotate-90 opacity-50" />
    </div>
  );
}

function BotRow(props: {
  name: string;
  title: string;
  color: string;
  mood: MascotMood;
  time: string;
  selected?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] px-2 py-2.5",
        props.selected && "bg-selected",
      )}
    >
      <AvatarMark
        name={props.name}
        color={props.color}
        shape="circle"
        mood={props.mood}
      />
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold">{props.name}</span>
          <span className="shrink-0 text-[11px] text-muted">{props.time}</span>
        </span>
        <div className="mt-0.5 overflow-hidden text-xs text-ellipsis whitespace-nowrap text-muted">
          {props.title}
        </div>
      </span>
    </div>
  );
}

function ComposerMock(props: { running: boolean }) {
  return (
    <div
      className="flex w-full flex-col gap-2 rounded-3xl border border-line bg-card p-2"
      style={{ ["--composer-radius" as string]: "1.5rem" }}
    >
      <p className="min-h-10 px-2.5 py-1 text-base leading-6 text-muted">
        Message Chief
      </p>
      <div className="flex items-center justify-end">
        {props.running ? (
          <TooltipIconButton
            tooltip="Stop generating"
            side="bottom"
            type="button"
            variant="default"
            size="icon"
            className="size-7 rounded-full"
            aria-label="Stop generating"
          >
            <SquareIcon className="size-3.5 fill-current" />
          </TooltipIconButton>
        ) : (
          <TooltipIconButton
            tooltip="Send message"
            side="bottom"
            type="button"
            variant="default"
            size="icon"
            className="size-7 rounded-full bg-accent text-white hover:bg-accent/90"
            aria-label="Send message"
          >
            <ArrowUpIcon className="size-4" />
          </TooltipIconButton>
        )}
      </div>
    </div>
  );
}
