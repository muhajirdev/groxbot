import {
  type DiscoveryOrigins,
  GROXBOT_EMAIL,
  GROXBOT_GITHUB,
  GROXBOT_LICENSE,
  GROXBOT_NAME,
  GROXBOT_SUMMARY,
  GROXBOT_UPDATED,
  GROXBOT_VERSION,
  officeOrigin,
} from "./identity.js";

function abs(origin: string, path: string): string {
  return `${origin.replace(/\/$/, "")}${path}`;
}

export const PRESS_SHORT =
  "Groxbot is Grok Bot for teams: named AI teammates with a real computer. If OpenClaw is for your personal use, Groxbot is for the office. Self-hostable. No workflow builder.";

export const PRESS_MEDIUM = GROXBOT_SUMMARY;

export const PRESS_LONG = `${GROXBOT_NAME} is a messaging app of named AI teammates, not a workflow builder, IDE, or Discord. You hire a Bot — name, optional job, description, avatar — then talk to it in a thread. Each Bot has a real computer, already built in. Live docs, slides, and sheets open from a card in chat.

The name is a joke that stuck: Grok, then grox. It copies Grok Bot’s simplicity (talk first, grant access when they hit a wall) and is fair-code so you can self-host. Bring your own model keys. Gmail, Slack, GitHub, and 1,000+ tools connect in the thread. Indie tools run on the computer. Self-host for your organization is free. Hosted Groxbot for others is groxbot.com.`;

export const PRESS_BOILERPLATE = [
  { id: "short", label: "Short", text: PRESS_SHORT },
  { id: "medium", label: "Medium", text: PRESS_MEDIUM },
  { id: "long", label: "Long", text: PRESS_LONG },
] as const;

export const PRESS_COLORS = [
  {
    name: "Accent",
    hex: "#e45c9a",
    note: "Mark, mascot default, hire-me pink",
  },
  {
    name: "Ink",
    hex: "#f4f4f4",
    note: "Type on dark chrome",
  },
  {
    name: "Background",
    hex: "#000000",
    note: "Marketing site and office",
  },
  {
    name: "Ok",
    hex: "#3ecf8e",
    note: "Done / working well",
  },
] as const;

export const PRESS_NAMES_OK = [
  "Groxbot (canonical, one word, capital G)",
  "groxbot.com (website)",
  "@groxbot/* (npm packages)",
] as const;

export const PRESS_NAMES_NO = [
  "GroxBot (camel-case B)",
  "Grokbot",
  "xAI Grok Bot, Grok Bot by xAI, or Cursor Grok Bot for this project",
  "Grogbot (retired name; grogbot.com is not this product)",
  "Rekan (retired scaffold name)",
] as const;

export const PRESS_VOICE = [
  "A Bot is a teammate (contact), not a workflow node.",
  "Computer means that bot’s workspace, not a second product and not the LLM.",
  "Each bot is one Durable Object (`BotActor`) with one office thread in v1; the computer is built in.",
  "First action is talk, not configure a graph.",
  "Do not call the product an agent builder, copilot IDE, or Discord.",
] as const;

export const PRESS_ASSETS = [
  {
    file: "groxbot-mark.svg",
    label: "Mark",
    note: "Transparent mascot. Use this most of the time.",
  },
  {
    file: "groxbot-mark-dark.svg",
    label: "Mark on dark",
    note: "Rounded tile for dark slides and sites.",
  },
  {
    file: "groxbot-mark-light.svg",
    label: "Mark on light",
    note: "Rounded tile for light backgrounds.",
  },
  {
    file: "groxbot-lockup-dark.svg",
    label: "Lockup on dark",
    note: "Mascot plus the word Groxbot.",
  },
  {
    file: "groxbot-lockup-light.svg",
    label: "Lockup on light",
    note: "Same lockup for light backgrounds.",
  },
] as const;

export function pressFacts(origins: DiscoveryOrigins): Array<{
  label: string;
  value: string;
  href?: string;
}> {
  const web = origins.web.replace(/\/$/, "");
  const office = officeOrigin(origins);
  return [
    { label: "Product", value: GROXBOT_NAME },
    { label: "Site", value: web.replace(/^https:\/\//, ""), href: `${web}/` },
    {
      label: "Office",
      value: office.replace(/^https:\/\//, ""),
      href: `${office}/login`,
    },
    {
      label: "Source",
      value: "github.com/muhajirdev/groxbot",
      href: GROXBOT_GITHUB,
    },
    {
      label: "License",
      value: GROXBOT_LICENSE,
      href: `${GROXBOT_GITHUB}/blob/main/LICENSE`,
    },
    {
      label: "Email",
      value: GROXBOT_EMAIL,
      href: `mailto:${GROXBOT_EMAIL}`,
    },
    {
      label: "Press kit",
      value: `${web.replace(/^https:\/\//, "")}/press`,
      href: abs(web, "/press"),
    },
  ];
}

export function pressMarkdown(origins: DiscoveryOrigins): string {
  const web = origins.web.replace(/\/$/, "");
  const facts = pressFacts(origins)
    .map((fact) => `- ${fact.label}: ${fact.href ?? fact.value}`)
    .join("\n");
  const assets = PRESS_ASSETS.map(
    (asset) =>
      `- [${asset.label}](${abs(web, `/press/${asset.file}`)}): ${asset.note}`,
  ).join("\n");
  return `# ${GROXBOT_NAME} press kit
# ${abs(web, "/press")}
# Version: ${GROXBOT_VERSION}
# Last Updated: ${GROXBOT_UPDATED}

Human page: ${abs(web, "/press")}
Brand rules: ${abs(web, "/brand.txt")}

## Boilerplate

### Short

${PRESS_SHORT}

### Medium

${PRESS_MEDIUM}

### Long

${PRESS_LONG}

## Facts

${facts}

## Name

Use:
${PRESS_NAMES_OK.map((item) => `- ${item}`).join("\n")}

Do not use:
${PRESS_NAMES_NO.map((item) => `- ${item}`).join("\n")}

## Voice

${PRESS_VOICE.map((item) => `- ${item}`).join("\n")}

## Colors

${PRESS_COLORS.map((color) => `- ${color.name}: ${color.hex} — ${color.note}`).join("\n")}

## Logos

SVG only. Do not add drop shadows, recolor the mascot away from ${PRESS_COLORS[0]?.hex}, replace the two slits, or draw a photoreal head.

${assets}

## Contact

Email: ${GROXBOT_EMAIL}
GitHub: ${GROXBOT_GITHUB}
Do not invent a pricing page or Ultra paywall.
`;
}
