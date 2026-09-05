/** Curated first-party bot hire templates (static product config, like MODEL_CATALOG). */

export type BotMarketplaceKind = "job" | "person";

export type BotMarketplaceTemplate = {
  id: string;
  /** Hire name shown in the roster and used for office-intro. */
  name: string;
  /** Short card copy (≤160 chars display discipline). */
  blurb: string;
  category: string;
  kind: BotMarketplaceKind;
  /**
   * Job line when `kind` is `"person"` (optional `title` on create).
   * Unused for job templates — the name is the role.
   */
  title?: string;
  /** When true, included in onboarding first-hire chips. */
  starter?: boolean;
};

export const BOT_MARKETPLACE_CATALOG: readonly BotMarketplaceTemplate[] = [
  {
    id: "chief-of-staff",
    name: "Chief of Staff",
    blurb: "Prioritize the week, draft updates, and surface decisions that need your approval.",
    category: "Operations",
    kind: "job",
    starter: true,
  },
  {
    id: "talent-scout",
    name: "Talent Scout",
    blurb: "Source candidates, score fit, and prep interview notes — you send every outreach.",
    category: "People",
    kind: "job",
    starter: true,
  },
  {
    id: "expense-manager",
    name: "Expense Manager",
    blurb: "Categorize spend, flag outliers, and draft reimbursement notes for your approval.",
    category: "Finance",
    kind: "job",
    starter: true,
  },
  {
    id: "bug-reproduction",
    name: "Bug Reproduction",
    blurb: "Repro steps, logs, and a tight write-up so engineering can fix without guessing.",
    category: "Engineering",
    kind: "job",
    starter: true,
  },
  {
    id: "product-performance",
    name: "Product Performance",
    blurb: "Pull metrics, compare cohorts, and call out what moved — no vanity dashboards.",
    category: "Growth",
    kind: "job",
    starter: true,
  },
  {
    id: "sales-outbound",
    name: "Sales Outbound",
    blurb: "Draft follow-ups from the account list. Do not send. Ask before anything leaves.",
    category: "Growth",
    kind: "job",
    starter: true,
  },
  {
    id: "paid-media",
    name: "Paid Media",
    blurb: "Audit creatives and spend, draft pause/scale notes — you approve every change.",
    category: "Growth",
    kind: "job",
  },
  {
    id: "account-health",
    name: "Account Health",
    blurb: "Watch renewals and risk signals, then draft the save plan you decide to send.",
    category: "Growth",
    kind: "job",
  },
  {
    id: "social-scheduling",
    name: "Social Scheduling",
    blurb: "Draft posts and a calendar from your brief. Publish only after you say go.",
    category: "Growth",
    kind: "job",
  },
  {
    id: "inbox-triage",
    name: "Inbox Triage",
    blurb: "Sort the pile, draft replies, and flag anything that needs your eyes.",
    category: "Operations",
    kind: "job",
  },
  {
    id: "shipping-updates",
    name: "Shipping Updates",
    blurb: "Turn PRs and releases into crisp status notes for the team and customers.",
    category: "Engineering",
    kind: "job",
  },
  {
    id: "founder-analytics",
    name: "Founder Analytics",
    blurb: "One honest weekly scorecard: revenue, burn, and the bets still open.",
    category: "Founder",
    kind: "job",
  },
  {
    id: "hormozi",
    name: "Hormozi",
    blurb: "Offers, hooks, and content angles — blunt feedback, no fluff.",
    category: "Founder",
    kind: "person",
    title: "Offer & content coach",
  },
] as const;

/** Onboarding chip names — job templates marked `starter`, in catalog order. */
export const BOT_MARKETPLACE_STARTER_JOBS: readonly string[] =
  BOT_MARKETPLACE_CATALOG.filter(
    (row) => row.kind === "job" && row.starter && row.name.trim().length > 0,
  ).map((row) => row.name);

export const BOT_MARKETPLACE_CATEGORIES: readonly string[] = [
  ...new Set(BOT_MARKETPLACE_CATALOG.map((row) => row.category)),
];

export function filterBotMarketplace(
  catalog: readonly BotMarketplaceTemplate[],
  query: string,
  category: string | null,
): BotMarketplaceTemplate[] {
  const q = query.trim().toLowerCase();
  return catalog.filter((row) => {
    if (category && row.category !== category) return false;
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) || row.blurb.toLowerCase().includes(q)
    );
  });
}

/** Hire payload fields from a catalog template (name + optional person title). */
export function hireFieldsFromTemplate(template: BotMarketplaceTemplate): {
  name: string;
  title?: string;
} {
  if (template.kind === "person" && template.title?.trim()) {
    return { name: template.name, title: template.title.trim() };
  }
  return { name: template.name };
}
