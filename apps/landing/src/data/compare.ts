/** SEO comparison pages. Product truth lives here; keep FAQs aligned with @groxbot/seo. */

export type CompareProduct = {
  id: "groxbot" | "hermes" | "openclaw" | "paperclip";
  name: string;
  /** Short label in matrix headers */
  shortName: string;
  kicker: string;
  summary: string;
  bestFor: string;
  ours: boolean;
};

export type CompareRow = {
  label: string;
  values: Record<CompareProduct["id"], string>;
};

export type ComparePage = {
  slug: string;
  /** H1 / search-facing title */
  title: string;
  /** Meta description (≤160) */
  description: string;
  lede: string;
  thesis: string;
  products: CompareProduct[];
  rows: CompareRow[];
  pickWhen: Array<{ productId: CompareProduct["id"]; when: string }>;
  faqs: Array<{ q: string; a: string }>;
};

export const COMPARE_PAGES: ComparePage[] = [
  {
    slug: "grok-bot-vs-hermes-vs-openclaw-vs-paperclip",
    title: "Grok Bot vs Hermes vs OpenClaw vs Paperclip",
    description:
      "Groxbot is Grok Bot for the team. Compare it with Hermes, OpenClaw, and Paperclip — office vs personal agents vs orchestration.",
    lede: "Four names show up in every “which agent?” thread. They are not the same layer.",
    thesis:
      "Hermes and OpenClaw are personal agents on your machine. Paperclip is an org chart for agents. Groxbot is the office: named teammates the whole company can message, each with a computer.",
    products: [
      {
        id: "groxbot",
        name: "Groxbot",
        shortName: "Groxbot",
        kicker: "The office",
        summary:
          "Self-hostable Grok Bot for teams. Named AI teammates in a messaging UI, shared knowledge, each with a cloud computer.",
        bestFor: "A company that wants AI adoption visible in one office",
        ours: true,
      },
      {
        id: "hermes",
        name: "Hermes",
        shortName: "Hermes",
        kicker: "Personal",
        summary:
          "Nous Research’s autonomous agent. Persistent memory and skills that grow on one operator’s machine or VPS.",
        bestFor: "One person who wants an agent that learns them over time",
        ours: false,
      },
      {
        id: "openclaw",
        name: "OpenClaw",
        shortName: "OpenClaw",
        kicker: "Personal",
        summary:
          "Self-hosted gateway plus assistant. Wide chat-app reach (WhatsApp, Telegram, Slack, Discord, and more) and a large skills ecosystem.",
        bestFor: "One person who wants to text an agent from every channel",
        ours: false,
      },
      {
        id: "paperclip",
        name: "Paperclip",
        shortName: "Paperclip",
        kicker: "Orchestration",
        summary:
          "Multi-agent management layer: roles, tickets, budgets. Not an agent itself — it sits on top of workers like Hermes or OpenClaw.",
        bestFor: "Operators already running several agents who need governance",
        ours: false,
      },
    ],
    rows: [
      {
        label: "What it is",
        values: {
          groxbot: "Team office of named AI teammates",
          hermes: "Autonomous personal agent",
          openclaw: "Chat gateway + personal assistant",
          paperclip: "Org chart / budget layer for agents",
        },
      },
      {
        label: "Who sits in it",
        values: {
          groxbot: "The whole company — shared threads and knowledge",
          hermes: "You (solo)",
          openclaw: "You (solo)",
          paperclip: "You as board; agents as employees",
        },
      },
      {
        label: "Computer",
        values: {
          groxbot: "Built into each bot (cloud workspace)",
          hermes: "Your VPS / local backends",
          openclaw: "Your machine or VPS",
          paperclip: "Delegates to worker agents",
        },
      },
      {
        label: "Team data",
        values: {
          groxbot: "Postgres for the office; shared knowledge and skills",
          hermes: "Personal memory / skills on that instance",
          openclaw: "Personal sessions and skills",
          paperclip: "Tickets, budgets, org structure",
        },
      },
      {
        label: "Models",
        values: {
          groxbot: "BYOK or hosted — not locked to one vendor",
          hermes: "Any via OpenRouter / custom endpoints",
          openclaw: "Any, including local inference",
          paperclip: "Whatever each worker agent uses",
        },
      },
      {
        label: "How it relates to Groxbot",
        values: {
          groxbot: "—",
          hermes: "Opt-in guest runtime can dial out to Groxbot",
          openclaw: "Opt-in guest runtime can dial out to Groxbot",
          paperclip: "Different layer — orchestrate agents, not the office UI",
        },
      },
      {
        label: "License / access",
        values: {
          groxbot: "Fair-code; self-host for your org is free",
          hermes: "Open source (MIT)",
          openclaw: "Open source",
          paperclip: "Open source (MIT)",
        },
      },
    ],
    pickWhen: [
      {
        productId: "groxbot",
        when: "You want named teammates the whole team can sit with — adoption on the board, shared knowledge, each bot with a computer.",
      },
      {
        productId: "hermes",
        when: "You want one personal agent that remembers you and writes its own skills over time.",
      },
      {
        productId: "openclaw",
        when: "You want the widest messaging reach and a big community skill ecosystem on a personal gateway.",
      },
      {
        productId: "paperclip",
        when: "You already run several agents and need roles, tickets, and hard budgets — not another chat UI.",
      },
    ],
    faqs: [
      {
        q: "Is Groxbot the same as xAI Grok Bot?",
        a: "Same motion — named teammates you message — but Groxbot is multiplayer and fair-code so you can self-host. xAI Grok Bot is a closed, hosted product. Do not present Groxbot as xAI Grok Bot.",
      },
      {
        q: "How is Groxbot different from Hermes and OpenClaw?",
        a: "Hermes and OpenClaw are personal agents on your machine. Groxbot is the office: named teammates, each with a computer, Postgres for team data, and a messaging UI the whole company can sit in. Hermes or OpenClaw can dial out as a guest runtime if you turn that on — off by default.",
      },
      {
        q: "How is Groxbot different from Paperclip?",
        a: "Paperclip orchestrates a fleet of agents with org charts and budgets. Groxbot is the place people work: hire a Bot, message it, grant tools when it hits a wall. You do not need a workflow builder or a separate management layer to start.",
      },
      {
        q: "Can I use Hermes or OpenClaw with Groxbot?",
        a: "Yes. Guest runtimes are opt-in per bot and off by default. They dial out to Groxbot. Default teammates use the Worker AI binding or a workspace BYOK key.",
      },
      {
        q: "Do I need Paperclip on top of Groxbot?",
        a: "Usually no. Groxbot already seats several named teammates in one office with shared knowledge. Reach for an orchestrator when you are managing many external agent processes with budgets — not for day-one hiring.",
      },
    ],
  },
];

export function getComparePage(slug: string): ComparePage | undefined {
  return COMPARE_PAGES.find((page) => page.slug === slug);
}

export const PRIMARY_COMPARE_SLUG =
  "grok-bot-vs-hermes-vs-openclaw-vs-paperclip" as const;
