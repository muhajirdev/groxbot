import { GROXBOT_EMAIL, GROXBOT_TAGLINE } from "@groxbot/seo";
import { formatIntegrationCount } from "./integrations";

export const CONTACT_EMAIL = GROXBOT_EMAIL;
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;
export const INVITE_EMAIL = "muhajir@expandra.ai";
export const INVITE_MAILTO = `mailto:${INVITE_EMAIL}`;
export const START_CTA = "Request an invite";

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
    name: "OpenClaw / Hermes",
    kicker: "Personal",
    line: "An agent on your machine. Capable, and yours alone.",
    ours: false,
  },
  {
    name: "Paperclip",
    kicker: "Orchestration",
    line: "Org charts and budgets for agents — not a team chat.",
    ours: false,
  },
  {
    name: "Grok Bot",
    kicker: "Closed",
    line: "Named teammates with a computer — behind a paywall.",
    ours: false,
  },
  {
    name: "Whip Computer",
    kicker: "For teams",
    line: "Multiplayer. Shared knowledge. Source on GitHub.",
    ours: true,
  },
] as const;

/** Homepage links into the SEO compare set. */
export const COMPARE_LINKS = [
  {
    label: "All four",
    slug: "grok-bot-vs-hermes-vs-openclaw-vs-paperclip",
  },
  { label: "vs Hermes", slug: "grok-bot-vs-hermes" },
  { label: "vs OpenClaw", slug: "grok-bot-vs-openclaw" },
  { label: "vs Paperclip", slug: "grok-bot-vs-paperclip" },
] as const;

export const COMPARE_CALLOUT = {
  kicker: "Compare",
  title: "Whip Computer vs Hermes vs OpenClaw vs Paperclip",
  lede: "Multiplayer and a shared knowledge base are the gap. Hermes still leads the solo self-evolving agent — Whip Computer is the self-improving team.",
} as const;

export const FAQS = [
  {
    q: "How is this different from OpenClaw or Hermes?",
    a: "Those are personal agents on your machine. Whip Computer is for the team: named teammates, each with a cloud computer, a shared knowledge base, and a messaging UI the whole company can sit in.",
  },
  {
    q: "Do I need a workflow builder?",
    a: "No. Create a Bot, message it, grant access as needed. There isn’t anything to learn — it’s like bringing on a coworker.",
  },
  {
    q: "Is it open source?",
    a: "The source is on GitHub. Self-host for your own team is free. Fair-code: you may not run a hosted Whip Computer for third parties without a commercial license — that is whip.computer.",
  },
  {
    q: "Which models can I use?",
    a: "Any of them. Bring your own keys — OpenRouter is one key for many models, or paste Anthropic, OpenAI, or Cloudflare. Claude, GPT, Grok, Kimi, DeepSeek. You are not locked to one vendor.",
  },
  {
    q: "Does my data leave Whip Computer?",
    a: "Self-host and your data stays in your SQLite catalog and Durable Objects — whip.computer never sees it. Hosted stores it for you. A Bot talking to a model sends the prompt to the provider behind your key. We do not claim zero retention: Whip Computer is meant to remember.",
  },
] as const;

export const SOURCE_REPO = "https://github.com/muhajirdev/groxbot";
export const MAC_DMG_FILENAME = "Groxbot-mac-arm64.dmg";
export const MAC_DMG_URL = `${SOURCE_REPO}/releases/latest/download/${MAC_DMG_FILENAME}`;
export const TAGLINE = GROXBOT_TAGLINE;
export const HERO_PITCH = "Multiplayer. Open source. Invite only.";
export const HERO_HEADLINE = "AI for teams.";
export const TALK_HEADLINE = "Invite your team to talk with your AI agents.";
export const TALK_POINTS = [
  { icon: "build", text: "Experts build the agent" },
  { icon: "team", text: "The team uses it" },
  { icon: "up", text: "The company gets more done" },
] as const;
export const TALK_LEDE = `${TALK_POINTS.map((item) => item.text).join(". ")}.`;
export const ADOPT_HEADLINE = "Track your team's AI adoption.";
export const ADOPT_POINTS = [
  { icon: "people", text: "See who put work in motion" },
  { icon: "heat", text: "A contributions heatmap" },
  { icon: "spend", text: "Not a spend cockpit" },
] as const;
export const KNOW_HEADLINE = "A knowledge base that improves itself.";
export const KNOW_POINTS = [
  {
    icon: "file",
    text: "Chat is automatically organized onto the knowledge base",
  },
  { icon: "loop", text: "It updates itself as you work" },
  { icon: "share", text: "The whole team shares one" },
] as const;
export const JOBS_HEADLINE = "A Bot. Your tools. The job.";
export const MEET_HEADLINE = "Meet your team where they work.";
export const MEET_CHANNELS = [
  { name: "Slack", slug: "slack" },
  { name: "Discord", slug: "discord" },
  { name: "Microsoft Teams", slug: "microsoft_teams" },
] as const;
export const PHONE_HEADLINE = "No Mac Mini is required.";
export const PHONE_LEDE =
  "Prompt from your phone even when your laptop is shut down.";
export const APPS_HEADLINE = "Connect the bot to any apps.";
export const APPS_LEDE = `${formatIntegrationCount()} integrations.`;
export const APPS_TOOLS = [
  { name: "Instagram", slug: "instagram" },
  { name: "Gmail", slug: "gmail" },
  { name: "LinkedIn", slug: "linkedin" },
  { name: "Notion", slug: "notion" },
  { name: "Google Drive", slug: "googledrive" },
  { name: "GitHub", slug: "github" },
] as const;
export const HERO_COMPARE_NAMES = [
  "Hermes Agent",
  "OpenClaw",
  "Grok Bot",
] as const;
export const HERO_LEDE = `Like ${HERO_COMPARE_NAMES[0]}, ${HERO_COMPARE_NAMES[1]}, or ${HERO_COMPARE_NAMES[2]} — but for teams.`;
export const HERO_PLATFORMS = [
  { name: "Web" },
  { name: "Mac" },
  { name: "iOS" },
  { name: "Android" },
  { name: "Discord", icon: demoLogo("discord") },
  { name: "Slack", icon: demoLogo("slack") },
  { name: "Microsoft Teams", icon: demoLogo("microsoft_teams") },
] as const;
export const HERO_PLATFORMS_LINE = `Available for ${HERO_PLATFORMS.map((item) => item.name).join(", ")}`;
/** Swap `youtubeId` for the Whip Computer hero demo. */
export const HERO_DEMO = {
  youtubeId: "M7lc1UVf-VE",
  title: "A morning with the team",
} as const;
/** Swap `youtubeId` for the talk-section demo. Different from `HERO_DEMO`. */
export const TALK_DEMO = {
  youtubeId: "aqz-KE-bpKQ",
  title: "Talk with your agents",
} as const;

export function heroDemoSrc(
  id = HERO_DEMO.youtubeId,
  opts: { autoplay?: boolean; mute?: boolean; loop?: boolean } = {},
) {
  const params = new URLSearchParams({ rel: "0", playsinline: "1" });
  if (opts.autoplay) params.set("autoplay", "1");
  if (opts.mute || opts.autoplay) params.set("mute", "1");
  if (opts.loop) {
    params.set("loop", "1");
    params.set("playlist", id);
  }
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

export function heroDemoPoster(id = HERO_DEMO.youtubeId) {
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
}
export const FOOTER_BLURB = "Let’s start whipping the computer together.";

export const STORY = [
  {
    id: "hire",
    kicker: "Hire",
    title: "Start with a person, not a workflow.",
    lede: "Pick a teammate. They show up with a name, a desk, and a computer. Empty until you give them a job.",
  },
  {
    id: "talk",
    kicker: "Talk",
    title: "Message them like a coworker.",
    lede: "Give work in the thread. They come back when they need you. Not a prompt box — a conversation.",
  },
  {
    id: "computer",
    kicker: "Computer",
    title: "They already have a computer.",
    lede: "Built into the bot. Leave the pane open, or don’t. The work still happens.",
  },
] as const;

export const THESES = [
  {
    id: "together",
    kicker: "Together",
    title: "AI is better together.",
    lede: "OpenClaw or Hermes: one person, one laptop. Whip Computer: named teammates, one team.",
  },
  {
    id: "adopt",
    kicker: "Adoption",
    title: "Track your team's AI adoption.",
    lede: "A personal agent hides. Put people on the board. That’s how the rest of the team starts.",
  },
  {
    id: "knowledge",
    kicker: "Knowledge",
    title: "The company’s knowledge base should evolve from group chats.",
    lede: "Chat is automatically organized onto the knowledge base. Skills live with the team, not one chat. Monday doesn’t start from zero.",
  },
  {
    id: "phone",
    kicker: "Phone",
    title: "No Mac Mini is required.",
    lede: "Prompt from your phone even when your laptop is shut down.",
    why: "Ideas come anytime, anywhere. Execution is no longer the bottleneck — agents do the work. What matters now is good decisions and good ideas.",
  },
] as const;

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

export const HOME_FEATURES = [
  {
    title: "For the whole team",
    body: "Named teammates in one place — not another agent hiding on a laptop.",
  },
  {
    title: "Computer built in",
    body: "Hire a bot and they already have a cloud computer. Close the laptop; the work keeps going.",
  },
  {
    title: "Knowledge from the thread",
    body: "Chat is automatically organized onto the knowledge base — skills, voice, how you work.",
  },
] as const;

export const HOME_KNOWLEDGE = {
  thread: [
    "Maya: Ship Thursday. No jargon. Hold for me.",
    "Chief: Queued. Nothing live until you look.",
    "Jules: Same voice on the outbound recap.",
  ],
  files: [
    { path: "how-we-work/voice.md", note: "No jargon. Hold for Maya." },
    { path: "how-we-work/owners.md", note: "Outbound recaps: Jules." },
    {
      path: "skills/linkedin-teardown/SKILL.md",
      note: "Draft, queue, don’t publish.",
    },
  ],
} as const;

export const KNOW_GRAPH = {
  nodes: [
    { id: "voice", label: "voice.md", x: 36, y: 40, r: 2.6, hot: true },
    { id: "owners", label: "owners.md", x: 58, y: 28, r: 2.2 },
    { id: "skill", label: "SKILL.md", x: 70, y: 56, r: 2.5, hot: true },
    { id: "maya", label: "Maya", x: 20, y: 62, r: 2 },
    { id: "jules", label: "Jules", x: 46, y: 74, r: 2 },
    { id: "thursday", label: "Thursday", x: 28, y: 22, r: 1.8 },
    { id: "linkedin", label: "LinkedIn", x: 86, y: 42, r: 2.1 },
    { id: "a", x: 24, y: 38, r: 1.1 },
    { id: "b", x: 48, y: 18, r: 1 },
    { id: "c", x: 64, y: 44, r: 1.15 },
    { id: "d", x: 78, y: 68, r: 1 },
    { id: "e", x: 14, y: 48, r: 0.95 },
    { id: "f", x: 52, y: 52, r: 1.05 },
    { id: "g", x: 40, y: 58, r: 0.9 },
  ],
  edges: [
    ["thursday", "voice"],
    ["voice", "skill"],
    ["voice", "maya"],
    ["owners", "jules"],
    ["owners", "skill"],
    ["skill", "linkedin"],
    ["voice", "owners"],
    ["maya", "a"],
    ["thursday", "b"],
    ["skill", "c"],
    ["linkedin", "d"],
    ["maya", "e"],
    ["voice", "f"],
    ["jules", "g"],
  ],
} as const;
