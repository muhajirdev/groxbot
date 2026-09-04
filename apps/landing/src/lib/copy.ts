import { GROXBOT_EMAIL, GROXBOT_TAGLINE } from "@groxbot/seo";

export const CONTACT_EMAIL = GROXBOT_EMAIL;
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;

export const DEMOS = [
  {
    id: "linkedin",
    title: "Post to LinkedIn",
    blurb:
      "Write it in your voice. Queue it. Nothing goes live until you look.",
    toolLine: "LinkedIn",
    slugs: ["linkedin"],
    color: "#5b7cff",
    bot: "Outbound",
    useCaseSlug: "sales-outbound",
    prompt:
      "Write a teardown of yesterday’s launch for LinkedIn. My voice, no jargon. Queue Thursday 10am — don’t publish until I look.",
    actions: [
      {
        slug: "linkedin",
        name: "LinkedIn",
        call: "create_post",
        detail: "Thu 10am · parked for you",
      },
    ],
    reply:
      "Draft is queued on LinkedIn for Thursday 10am, held for you. Open it if the hook needs a pass.",
  },
  {
    id: "instagram",
    title: "Schedule Instagram",
    blurb: "Caption, cover, and a Thursday slot — from one message.",
    toolLine: "Instagram · Google Drive",
    slugs: ["instagram", "googledrive"],
    color: "#e45c9a",
    bot: "Social",
    useCaseSlug: "social-scheduling",
    prompt:
      "Schedule Thursday’s reel for 9am. Caption from the launch notes. Cover is in Drive. Don’t publish now.",
    actions: [
      {
        slug: "googledrive",
        name: "Google Drive",
        call: "get_file",
        detail: "cover.png",
      },
      {
        slug: "instagram",
        name: "Instagram",
        call: "schedule_post",
        detail: "Thu 9am · reel + caption",
      },
    ],
    reply:
      "Scheduled for Thursday 9am. Caption is on the reel. I didn’t publish now.",
  },
  {
    id: "drive",
    title: "Edit Drive on the go",
    blurb: "Update the sheet and the doc from the thread.",
    toolLine: "Google Drive · Sheets · Docs",
    slugs: ["googledrive", "googlesheets", "googledocs"],
    color: "#3ecf8e",
    bot: "Ops",
    integrationSlug: "googledrive",
    prompt:
      "Update the pipeline sheet with this week’s numbers. Then drop a one-pager in Docs for the board. Don’t share the folder.",
    actions: [
      {
        slug: "googlesheets",
        name: "Google Sheets",
        call: "append_rows",
        detail: "Pipeline Q3 · 12 rows",
      },
      {
        slug: "googledocs",
        name: "Google Docs",
        call: "update_document",
        detail: "Board one-pager",
      },
    ],
    reply:
      "Sheet has this week. Doc is in the same Drive folder. Sharing unchanged.",
  },
  {
    id: "notion",
    title: "File it in Notion",
    blurb: "Decisions, owners, dates — a page the team can open.",
    toolLine: "Notion",
    slugs: ["notion"],
    color: "#c9a227",
    bot: "Chief of Staff",
    useCaseSlug: "chief-of-staff",
    prompt:
      "Turn this meeting into a Notion page: decisions, owners, dates. Put it under Ops. Don’t ping anyone.",
    actions: [
      {
        slug: "notion",
        name: "Notion",
        call: "create_page",
        detail: "Ops / Week of Aug 17",
      },
    ],
    reply:
      "Page is under Ops. Three decisions, owners, dates. I didn’t ping anyone.",
  },
] as const;

/** Display-only hotlink. logos.composio.dev omits CORS headers. */
function composioLogo(slug: string): string {
  return `https://logos.composio.dev/api/${slug}`;
}

export function demoLogo(slug: string): string {
  return composioLogo(slug);
}

export const COMPARE = [
  {
    name: "OpenClaw",
    kicker: "Personal",
    line: "An agent on your machine. Capable, and yours alone.",
    ours: false,
  },
  {
    name: "Grok Bot",
    kicker: "Closed",
    line: "Named teammates with a computer — behind a paywall.",
    ours: false,
  },
  {
    name: "Groxbot",
    kicker: "The office",
    line: "The same idea, for the team. Shared knowledge. Source on GitHub.",
    ours: true,
  },
] as const;

export const FAQS = [
  {
    q: "How is this different from Grok Bot?",
    a: `Same motion: create a Bot, message it, grant access as needed. Groxbot is for the team — ${GROXBOT_TAGLINE}. Named teammates, each with a computer, live docs from chat — and you can run the source yourself.`,
  },
  {
    q: "How is this different from OpenClaw?",
    a: "OpenClaw is a personal agent on your machine. Groxbot is the office: named teammates, each with a computer, Postgres for team data, and a messaging UI the whole company can sit in.",
  },
  {
    q: "Do I need a workflow builder?",
    a: "No. Create a Bot, message it, grant access as needed. There isn’t anything to learn — it’s like bringing on a coworker.",
  },
  {
    q: "Where does the computer live?",
    a: "In the cloud, on that bot — not on your laptop. Hire a teammate and they already have a computer. Shut the machine, close the pane, pick up the thread on your phone. The work keeps going.",
  },
  {
    q: "Is it open source?",
    a: "The source is on GitHub. Self-host for your own team is free. Fair-code: you may not run a hosted Groxbot for third parties without a commercial license — that is groxbot.com.",
  },
  {
    q: "Which tools can a Bot use?",
    a: "LinkedIn, Instagram, Google Drive, Docs, Sheets, Notion, Gmail, Slack, GitHub, and 1,000+ more. Indie tools like DataFast and Postiz run on the Bot’s computer. Grant access when they hit a wall — not in a 20-field wizard.",
  },
  {
    q: "Where do I talk to a Bot?",
    a: "In the web office — a messaging app of named teammates. Desktop is that same UI in a window. The computer stays in the cloud, so you can leave the laptop and continue on your phone.",
  },
  {
    q: "Does the office remember?",
    a: "Yes. What you decide in a thread is extracted into shared office knowledge — how we work, voice, constraints. Skills live with the workspace, not in one chat. The organization improves; you do not re-explain it every Monday.",
  },
  {
    q: "Which models can I use?",
    a: "Any of them. Bring your own keys — OpenRouter is one key for many models, or paste Anthropic, OpenAI, or Cloudflare. Claude, GPT, Grok, Kimi, DeepSeek. You are not locked to one vendor.",
  },
  {
    q: "Can I see adoption across the team?",
    a: "Yes — and that’s the point. A personal agent hides on a laptop. Who is putting Bots to work is on the board, plus spend and which models. That’s how the rest of the team starts.",
  },
  {
    q: "Does my data leave the office?",
    a: "Self-host and the office stays in your Postgres and sandboxes — groxbot.com never sees it. Hosted stores it for you. Either way, a Bot talking to a model sends the prompt to the provider behind your key. Pick one with a zero-retention agreement if you need that. We do not claim zero retention: the office is meant to remember.",
  },
  {
    q: "How do I talk to a person?",
    a: `Email ${CONTACT_EMAIL}. GitHub issues for the source. The office is for the product — this mailbox is for you.`,
  },
] as const;

export const SOURCE_REPO = "https://github.com/muhajirdev/groxbot";
export const MAC_DOWNLOAD_URL = `${SOURCE_REPO}/releases`;
export const TAGLINE = GROXBOT_TAGLINE;
export const FOOTER_BLURB = `${GROXBOT_TAGLINE}. For the whole team. Fair-code.`;

export const HOME_MODELS = [
  {
    name: "Claude Opus",
    icon: "/models/claude.svg",
    tone: "light",
  },
  {
    name: "GPT",
    icon: "/models/openai.svg",
    tone: "light",
  },
  {
    name: "Grok",
    icon: "/models/grok.svg",
    tone: "light",
  },
  {
    name: "Kimi",
    icon: "/models/kimi.svg",
    tone: "dark",
  },
  {
    name: "DeepSeek",
    icon: "/models/deepseek.svg",
    tone: "light",
  },
] as const;

export const PEOPLE = {
  maya: { name: "Maya", photo: "/people/maya.jpg" },
  jules: { name: "Jules", photo: "/people/jules.jpg" },
  you: { name: "You", photo: "/people/you.jpg" },
  rahul: { name: "Rahul", photo: "/people/rahul.jpg" },
} as const;

export const HOME_ADOPTION = [
  { ...PEOPLE.maya, role: "Ops", tasks: 2410, label: "2,410" },
  { ...PEOPLE.jules, role: "Outbound", tasks: 1890, label: "1,890" },
  { ...PEOPLE.you, role: "Lead", tasks: 1240, label: "1,240" },
  { ...PEOPLE.rahul, role: "Scout", tasks: 980, label: "980" },
] as const;
