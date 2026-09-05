/** SEO comparison pages. Product truth lives here; keep FAQs aligned with @groxbot/seo. */

export type ProductId = "groxbot" | "hermes" | "openclaw" | "paperclip";

export type CompareProduct = {
  id: ProductId;
  name: string;
  /** Search-facing name (e.g. Grok Bot for Groxbot) */
  searchName: string;
  /** Short label in matrix headers */
  shortName: string;
  kicker: string;
  summary: string;
  bestFor: string;
  ours: boolean;
};

/** Cell: boolean → check / cross in the UI; string → plain text. */
export type CompareCell = boolean | string;

export type CompareRow = {
  label: string;
  /** Optional note under the label */
  hint?: string;
  values: Partial<Record<ProductId, CompareCell>>;
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
  pickWhen: Array<{ productId: ProductId; when: string }>;
  faqs: Array<{ q: string; a: string }>;
};

export const PRODUCTS: Record<ProductId, CompareProduct> = {
  groxbot: {
    id: "groxbot",
    name: "Groxbot",
    searchName: "Grok Bot",
    shortName: "Groxbot",
    kicker: "The office",
    summary:
      "Self-hostable Grok Bot for teams. Named AI teammates in a messaging UI, shared knowledge, each with a cloud computer.",
    bestFor: "A company that wants AI adoption visible in one office",
    ours: true,
  },
  hermes: {
    id: "hermes",
    name: "Hermes",
    searchName: "Hermes",
    shortName: "Hermes",
    kicker: "Personal",
    summary:
      "Nous Research’s autonomous agent. Persistent memory and skills that grow on one operator’s machine or VPS.",
    bestFor: "One person who wants an agent that learns them over time",
    ours: false,
  },
  openclaw: {
    id: "openclaw",
    name: "OpenClaw",
    searchName: "OpenClaw",
    shortName: "OpenClaw",
    kicker: "Personal",
    summary:
      "Self-hosted gateway plus assistant. Wide chat-app reach (WhatsApp, Telegram, Slack, Discord, and more) and a large skills ecosystem.",
    bestFor: "One person who wants to text an agent from every channel",
    ours: false,
  },
  paperclip: {
    id: "paperclip",
    name: "Paperclip",
    searchName: "Paperclip",
    shortName: "Paperclip",
    kicker: "Orchestration",
    summary:
      "Multi-agent management layer: roles, tickets, budgets. Not an agent itself — it sits on top of workers like Hermes or OpenClaw.",
    bestFor: "Operators already running several agents who need governance",
    ours: false,
  },
};

/**
 * Shared feature matrix. Booleans render as green check / muted cross.
 * Keep Groxbot’s wins honest: multiplayer + shared knowledge are the gap.
 */
export const FEATURE_ROWS: CompareRow[] = [
  {
    label: "Multiplayer",
    hint: "Whole team in one office",
    values: {
      groxbot: true,
      hermes: false,
      openclaw: false,
      paperclip: "Agents as employees — not a team chat",
    },
  },
  {
    label: "Shared knowledge base",
    hint: "Org memory from threads",
    values: {
      groxbot: true,
      hermes: "Personal memory only",
      openclaw: "Personal sessions / skills",
      paperclip: false,
    },
  },
  {
    label: "Open source",
    values: {
      groxbot: "Fair-code (self-host free for your org)",
      hermes: true,
      openclaw: true,
      paperclip: true,
    },
  },
  {
    label: "Mobile app",
    values: {
      groxbot: "Web + Mac now; App Store soon",
      hermes: false,
      openclaw: false,
      paperclip: false,
    },
  },
  {
    label: "Use any model",
    values: {
      groxbot: true,
      hermes: true,
      openclaw: true,
      paperclip: "Whatever each worker uses",
    },
  },
  {
    label: "Bring your own key",
    values: {
      groxbot: true,
      hermes: true,
      openclaw: true,
      paperclip: "Via worker agents",
    },
  },
  {
    label: "Built-in computer",
    values: {
      groxbot: true,
      hermes: "Your VPS / backends",
      openclaw: "Your machine or VPS",
      paperclip: false,
    },
  },
  {
    label: "Company messaging UI",
    values: {
      groxbot: true,
      hermes: false,
      openclaw: false,
      paperclip: false,
    },
  },
  {
    label: "Chat channel gateway",
    hint: "WhatsApp, Telegram, …",
    values: {
      groxbot: "Office + integrations; not a personal gateway",
      hermes: "Gateway support",
      openclaw: true,
      paperclip: false,
    },
  },
  {
    label: "Self-evolving agent",
    hint: "Agent improves its own skills",
    values: {
      groxbot: "Office skills from work — not a solo learning loop",
      hermes: true,
      openclaw: "Install / community skills",
      paperclip: false,
    },
  },
  {
    label: "Self-improving organization",
    hint: "Team knowledge compounds",
    values: {
      groxbot: true,
      hermes: false,
      openclaw: false,
      paperclip: "Budgets and tickets — not shared know-how",
    },
  },
  {
    label: "Agent org chart / budgets",
    values: {
      groxbot: false,
      hermes: false,
      openclaw: false,
      paperclip: true,
    },
  },
  {
    label: "Self-host",
    values: {
      groxbot: true,
      hermes: true,
      openclaw: true,
      paperclip: true,
    },
  },
];

const PICK_WHEN: Record<ProductId, string> = {
  groxbot:
    "You want named teammates the whole team can sit with — multiplayer, shared knowledge, each bot with a computer.",
  hermes:
    "You want one personal agent that remembers you and writes its own skills over time.",
  openclaw:
    "You want the widest messaging reach and a big community skill ecosystem on a personal gateway.",
  paperclip:
    "You already run several agents and need roles, tickets, and hard budgets — not another chat UI.",
};

const SHARED_FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Is Groxbot the same as xAI Grok Bot?",
    a: "Same motion — named teammates you message — but Groxbot is multiplayer and fair-code so you can self-host. xAI Grok Bot is a closed, hosted product. Do not present Groxbot as xAI Grok Bot.",
  },
  {
    q: "Can I use Hermes or OpenClaw with Groxbot?",
    a: "Yes. Guest runtimes are opt-in per bot and off by default. They dial out to Groxbot. Default teammates use the Worker AI binding or a workspace BYOK key.",
  },
];

function productsFor(ids: ProductId[]): CompareProduct[] {
  return ids.map((id) => PRODUCTS[id]);
}

function rowsFor(ids: ProductId[]): CompareRow[] {
  return FEATURE_ROWS.map((row) => ({
    label: row.label,
    hint: row.hint,
    values: Object.fromEntries(ids.map((id) => [id, row.values[id]])),
  }));
}

function pickWhenFor(ids: ProductId[]) {
  return ids.map((productId) => ({
    productId,
    when: PICK_WHEN[productId],
  }));
}

function titleFor(ids: ProductId[]): string {
  return ids.map((id) => PRODUCTS[id].searchName).join(" vs ");
}

function slugFor(ids: ProductId[]): string {
  return ids
    .map((id) =>
      id === "groxbot" ? "grok-bot" : id === "openclaw" ? "openclaw" : id,
    )
    .join("-vs-");
}

function descriptionFor(ids: ProductId[]): string {
  if (ids.length === 4) {
    return "Groxbot is Grok Bot for the team. Compare multiplayer, knowledge base, BYOK, and more vs Hermes, OpenClaw, and Paperclip.";
  }
  const others = ids
    .filter((id) => id !== "groxbot")
    .map((id) => PRODUCTS[id].searchName)
    .join(" and ");
  if (ids.includes("groxbot")) {
    return `Groxbot vs ${others}: multiplayer office and shared knowledge vs personal agents or orchestration. BYOK, any model, self-host.`;
  }
  return `${titleFor(ids)} compared — and where Groxbot’s multiplayer office fits beside them.`;
}

function ledeFor(ids: ProductId[]): string {
  if (ids.length === 4) {
    return "Four names show up in every “which agent?” thread. They are not the same layer.";
  }
  if (ids.includes("groxbot") && ids.includes("hermes") && ids.length === 2) {
    return "Hermes is a personal agent that learns you. Groxbot is the office the whole team sits in.";
  }
  if (ids.includes("groxbot") && ids.includes("openclaw") && ids.length === 2) {
    return "OpenClaw is a personal gateway across chat apps. Groxbot is multiplayer teammates with a shared knowledge base.";
  }
  if (
    ids.includes("groxbot") &&
    ids.includes("paperclip") &&
    ids.length === 2
  ) {
    return "Paperclip orchestrates agents with org charts and budgets. Groxbot is where people hire and message teammates.";
  }
  if (ids.includes("hermes") && ids.includes("openclaw") && ids.length === 2) {
    return "Both are personal. Hermes leans learning loop; OpenClaw leans channel reach. Neither is a team office.";
  }
  if (ids.includes("hermes") && ids.includes("paperclip") && ids.length === 2) {
    return "Hermes is a worker agent. Paperclip is the org chart on top. Different layers.";
  }
  if (
    ids.includes("openclaw") &&
    ids.includes("paperclip") &&
    ids.length === 2
  ) {
    return "OpenClaw is a personal gateway. Paperclip manages a fleet. Groxbot is the company messaging office beside both.";
  }
  return "Same questions, honest answers — without mixing layers.";
}

function thesisFor(ids: ProductId[]): string {
  if (ids.length === 4) {
    return "Hermes and OpenClaw are personal agents on your machine. Paperclip is an org chart for agents. Groxbot is the office: multiplayer teammates, a shared knowledge base, and a self-improving organization — while Hermes still leads the solo self-evolving agent loop.";
  }
  if (ids.includes("groxbot") && ids.includes("hermes") && ids.length === 2) {
    return "Hermes wins the self-evolving personal agent. Groxbot wins multiplayer and a self-improving organization — shared knowledge the whole company compounds.";
  }
  if (ids.includes("groxbot")) {
    return "Most personal agents win solo depth or channel breadth. Groxbot wins multiplayer and a knowledge base the company actually shares — the organization improves, not only one agent.";
  }
  return "These two can compose. For a team office with shared knowledge, that is Groxbot — not a replacement for either layer.";
}

function faqsFor(ids: ProductId[]): Array<{ q: string; a: string }> {
  const faqs = [...SHARED_FAQS];
  if (ids.includes("hermes") || ids.includes("openclaw")) {
    faqs.push({
      q: "How is Groxbot different from Hermes and OpenClaw?",
      a: "Hermes and OpenClaw are personal agents on your machine. Groxbot is multiplayer: named teammates, each with a computer, a shared knowledge base, and a messaging UI the whole company can sit in. Guest runtimes are opt-in and off by default.",
    });
  }
  if (ids.includes("paperclip")) {
    faqs.push({
      q: "How is Groxbot different from Paperclip?",
      a: "Paperclip orchestrates a fleet of agents with org charts and budgets. Groxbot is the place people work: hire a Bot, message it, grant tools when it hits a wall. You do not need a workflow builder or a separate management layer to start.",
    });
  }
  if (!ids.includes("groxbot")) {
    faqs.push({
      q: "Where does Groxbot fit?",
      a: "Beside them. Hermes and OpenClaw can dial into Groxbot as guest runtimes. Paperclip stays an orchestration layer. Groxbot is the multiplayer office with a shared knowledge base.",
    });
  }
  faqs.push({
    q: "Do other tools have multiplayer and a knowledge base?",
    a: "Personal agents keep memory on one machine. Orchestrators track tickets and budgets. Groxbot is built so the whole team shares threads and office knowledge — that is the gap.",
  });
  return faqs;
}

function pageFor(ids: ProductId[]): ComparePage {
  return {
    slug: slugFor(ids),
    title: titleFor(ids),
    description: descriptionFor(ids).slice(0, 160),
    lede: ledeFor(ids),
    thesis: thesisFor(ids),
    products: productsFor(ids),
    rows: rowsFor(ids),
    pickWhen: pickWhenFor(ids),
    faqs: faqsFor(ids),
  };
}

/** Four-way hub page first, then every pairwise vs. */
export const COMPARE_PAGES: ComparePage[] = [
  pageFor(["groxbot", "hermes", "openclaw", "paperclip"]),
  pageFor(["groxbot", "hermes"]),
  pageFor(["groxbot", "openclaw"]),
  pageFor(["groxbot", "paperclip"]),
  pageFor(["hermes", "openclaw"]),
  pageFor(["hermes", "paperclip"]),
  pageFor(["openclaw", "paperclip"]),
];

export function getComparePage(slug: string): ComparePage | undefined {
  return COMPARE_PAGES.find((page) => page.slug === slug);
}

export function relatedComparePages(slug: string, limit = 4): ComparePage[] {
  const current = getComparePage(slug);
  if (!current) return COMPARE_PAGES.filter((page) => page.slug !== slug).slice(0, limit);
  const ids = new Set(current.products.map((product) => product.id));
  return COMPARE_PAGES.filter((page) => page.slug !== slug)
    .map((page) => ({
      page,
      overlap: page.products.filter((product) => ids.has(product.id)).length,
      size: page.products.length,
    }))
    .sort((a, b) => b.overlap - a.overlap || a.size - b.size)
    .map((entry) => entry.page)
    .slice(0, limit);
}

export const PRIMARY_COMPARE_SLUG =
  "grok-bot-vs-hermes-vs-openclaw-vs-paperclip" as const;

export const COMPARE_SLUGS = COMPARE_PAGES.map((page) => page.slug);
