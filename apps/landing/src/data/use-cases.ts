export type UseCaseCategoryId =
  | "sales"
  | "marketing"
  | "seo"
  | "operations"
  | "support"
  | "data"
  | "engineering"
  | "founder";

export type UseCaseCategory = {
  id: UseCaseCategoryId;
  label: string;
  blurb: string;
};

export const USE_CASE_CATEGORIES: UseCaseCategory[] = [
  {
    id: "sales",
    label: "Sales",
    blurb: "Pipeline, outbound, and call follow-up — drafts only until you send.",
  },
  {
    id: "marketing",
    label: "Marketing",
    blurb: "Content, social, and campaigns without an auto-publish gun.",
  },
  {
    id: "seo",
    label: "SEO",
    blurb: "Research, briefs, and refreshes. Publish stays yours.",
  },
  {
    id: "operations",
    label: "Operations",
    blurb: "Chief of Staff rhythm, sheets, invoices, and the indie stack.",
  },
  {
    id: "support",
    label: "Support",
    blurb: "Inbox and tickets triaged. Replies wait for you.",
  },
  {
    id: "data",
    label: "Data",
    blurb: "Answers with citations. Dashboards stay read-only.",
  },
  {
    id: "engineering",
    label: "Engineering",
    blurb: "Bugs, shipping notes, and research on a real computer.",
  },
  {
    id: "founder",
    label: "Founder",
    blurb: "The weekly jobs founders actually message first.",
  },
];

export type UseCase = {
  slug: string;
  category: UseCaseCategoryId;
  title: string;
  kicker: string;
  lede: string;
  problem: string;
  whatTheBotDoes: string[];
  neverWithoutApproval: string[];
  integrationSlugs: string[];
  firstMessage: string;
  faqs: Array<{ q: string; a: string }>;
};

export function getUseCase(slug: string): UseCase | undefined {
  return USE_CASES.find((item) => item.slug === slug);
}

export function getUseCaseCategory(
  id: UseCaseCategoryId,
): UseCaseCategory | undefined {
  return USE_CASE_CATEGORIES.find((item) => item.id === id);
}

export function useCasesByCategory(id: UseCaseCategoryId): UseCase[] {
  return USE_CASES.filter((item) => item.category === id);
}

export function relatedUseCases(item: UseCase, limit = 4): UseCase[] {
  const others = USE_CASES.filter((other) => other.slug !== item.slug);
  const sameCategory = others.filter(
    (other) => other.category === item.category,
  );
  const withOverlap = others
    .map((other) => ({
      other,
      overlap: other.integrationSlugs.filter((slug) =>
        item.integrationSlugs.includes(slug),
      ).length,
      same: other.category === item.category ? 1 : 0,
    }))
    .sort(
      (a, b) =>
        b.same - a.same ||
        b.overlap - a.overlap ||
        a.other.title.localeCompare(b.other.title),
    )
    .map((row) => row.other);
  const preferred = [
    ...sameCategory,
    ...withOverlap.filter(
      (other) => !sameCategory.some((row) => row.slug === other.slug),
    ),
  ];
  return preferred.slice(0, limit);
}

export const USE_CASES: UseCase[] = [
  {
    slug: "sales-outbound",
    category: "sales",
    title: "Sales outbound",
    kicker: "Hire a closer who does not send mail",
    lede: "Draft follow-ups from the account list. Do not send. Ask before anything leaves the thread.",
    problem:
      "Outbound dies in the gap between the CRM and the inbox. You know who to ping. You do not want a Bot spraying sequences.",
    whatTheBotDoes: [
      "Read the accounts you name in HubSpot, Salesforce, or a sheet.",
      "Draft the follow-up in the Bot thread, with the last touch cited.",
      "Stop before Gmail or Outlook sends.",
    ],
    neverWithoutApproval: [
      "Send email",
      "Enroll someone in a sequence",
      "Create or delete CRM records",
    ],
    integrationSlugs: ["hubspot", "salesforce", "gmail", "outlook", "linkedin"],
    firstMessage:
      "Draft follow-ups for this account list. Cite the last CRM touch. Do not send mail.",
    faqs: [
      {
        q: "Will it spam my pipeline?",
        a: "No. Whip Computer drafts. You grant send when the copy is right. There is no sequence canvas.",
      },
      {
        q: "Which CRM?",
        a: "HubSpot, Salesforce, Pipedrive — or the CRM in the browser on the computer.",
      },
    ],
  },
  {
    slug: "lead-generation",
    category: "sales",
    title: "Lead generation",
    kicker: "Find and enrich. You own outreach.",
    lede: "Build a sourced shortlist from the ICP you name. Enrich what you can. Never cold-email without you.",
    problem:
      "Lead gen tools dump CSVs. You still need someone to judge fit and draft the first line.",
    whatTheBotDoes: [
      "Search the sources you name against the ICP.",
      "Enrich with public web + Apollo or CRM when connected.",
      "Rank fit. Draft outreach. Stop before send.",
    ],
    neverWithoutApproval: [
      "Send cold email or InMail",
      "Buy a list",
      "Create CRM contacts in bulk",
    ],
    integrationSlugs: ["apollo", "linkedin", "hubspot", "salesforce", "gmail"],
    firstMessage:
      "Find 20 leads matching this ICP. Enrich and rank. Draft outreach. Do not send.",
    faqs: [
      {
        q: "Is this a scraper farm?",
        a: "No. It is a teammate with a computer and connectors. You approve every outbound message.",
      },
    ],
  },
  {
    slug: "lead-qualification",
    category: "sales",
    title: "Lead qualification",
    kicker: "Score inbound. Route with evidence.",
    lede: "Score inbound against your rubric. Draft the route note. Do not change CRM stage until you say so.",
    problem:
      "Inbound piles up. Auto-routing mislabels. You want a scorecard, not a black box.",
    whatTheBotDoes: [
      "Read the form, email, or CRM record you name.",
      "Score against must-haves with citations.",
      "Draft the route note. Leave stage changes to you.",
    ],
    neverWithoutApproval: [
      "Change CRM stage",
      "Assign an owner",
      "Reply to the lead",
    ],
    integrationSlugs: ["hubspot", "salesforce", "pipedrive", "gmail", "slack"],
    firstMessage:
      "Qualify these inbound leads against our rubric. Score with evidence. Do not change CRM.",
    faqs: [
      {
        q: "Will it auto-disqualify?",
        a: "It recommends. Stage and owner stay yours until you confirm.",
      },
    ],
  },
  {
    slug: "crm-pipeline",
    category: "sales",
    title: "CRM pipeline",
    kicker: "Pipeline hygiene from chat",
    lede: "Pull the deals you name. Flag stale and missing fields. Propose updates. Never write the CRM until you approve.",
    problem:
      "The board is fiction by Thursday. Someone has to clean stages, next steps, and close dates.",
    whatTheBotDoes: [
      "Read HubSpot, Salesforce, or Pipedrive for the views you name.",
      "Flag stale deals and missing next steps with citations.",
      "Draft field updates. Do not write them live.",
    ],
    neverWithoutApproval: [
      "Edit CRM records",
      "Delete deals",
      "Message the account",
    ],
    integrationSlugs: [
      "hubspot",
      "salesforce",
      "pipedrive",
      "slack",
      "googlesheets",
    ],
    firstMessage:
      "Audit this pipeline view. Flag stale deals and missing next steps. Do not edit CRM.",
    faqs: [
      {
        q: "Salesforce or HubSpot?",
        a: "Either. Or both. The Bot works in the thread and stops before writes.",
      },
    ],
  },
  {
    slug: "meeting-prep",
    category: "sales",
    title: "Meeting prep",
    kicker: "Context before the call",
    lede: "One brief per meeting: people, last touches, open risks. No calendar moves. No outbound pings.",
    problem:
      "The invite is a title. The brief is still five tabs. You want one page before you join.",
    whatTheBotDoes: [
      "Read calendar, CRM, and notes for the meeting you name.",
      "Write people, history, risks, and suggested asks.",
      "Leave the calendar and inbox alone.",
    ],
    neverWithoutApproval: [
      "Move or cancel meetings",
      "Email attendees",
      "Create CRM tasks in bulk",
    ],
    integrationSlugs: [
      "googlecalendar",
      "hubspot",
      "notion",
      "gmail",
      "linkedin",
    ],
    firstMessage:
      "Prep brief for my next customer call. People, last touches, risks. Do not message anyone.",
    faqs: [
      {
        q: "Does it join the call?",
        a: "No. It prep-writes. Call recording tools stay separate if you use them.",
      },
    ],
  },
  {
    slug: "call-analysis",
    category: "sales",
    title: "Call analysis",
    kicker: "Patterns from Gong and notes",
    lede: "Pull themes from the calls you name. Draft follow-ups. Do not update CRM or email the prospect until you approve.",
    problem:
      "Gong is a library. You need themes, objections, and a next-step draft — not another dashboard login.",
    whatTheBotDoes: [
      "Read Gong, Fireflies, or the transcript you paste.",
      "Surface objections, commitments, and competitors mentioned.",
      "Draft CRM notes and follow-up email. Stop before send or write.",
    ],
    neverWithoutApproval: [
      "Send follow-up email",
      "Write CRM fields",
      "Share the recording",
    ],
    integrationSlugs: ["gong", "fireflies", "hubspot", "salesforce", "gmail"],
    firstMessage:
      "Analyze these calls for objections and next steps. Draft follow-ups. Do not send or edit CRM.",
    faqs: [
      {
        q: "Do I need Gong?",
        a: "Gong helps. A pasted transcript or Fireflies works too.",
      },
    ],
  },
  {
    slug: "account-health",
    category: "sales",
    title: "Account health",
    kicker: "Churn risk with evidence",
    lede: "Watch the accounts you name. Flag churn risk with evidence. Do not message the customer until you say so.",
    problem:
      "Health scores lie. You want the last ticket, the last invoice, the last login — in one paragraph.",
    whatTheBotDoes: [
      "Read CRM, support, and billing for the accounts you name.",
      "Flag risk with citations, not a red/green orb.",
      "Draft the save email. Do not send it.",
    ],
    neverWithoutApproval: [
      "Email the customer",
      "Change plan or refund",
      "Close the account",
    ],
    integrationSlugs: ["hubspot", "stripe", "zendesk", "intercom", "slack"],
    firstMessage:
      "Health read on these accounts. Cite CRM, billing, and tickets. Do not message the customer.",
    faqs: [
      {
        q: "Will it nag the customer?",
        a: "No. The memo stays in the Bot thread until you send.",
      },
    ],
  },
  {
    slug: "linkedin-research",
    category: "sales",
    title: "LinkedIn research",
    kicker: "Signals first. No auto-DM.",
    lede: "Research people and companies on LinkedIn. Draft the note. Never send connection requests or DMs without you.",
    problem:
      "LinkedIn automation burns accounts. You want research and a draft, not a bot in your DMs.",
    whatTheBotDoes: [
      "Research the profiles and companies you name.",
      "Extract role, timing, and relevant posts.",
      "Draft a connection note or InMail. Stop before send.",
    ],
    neverWithoutApproval: [
      "Send connection requests",
      "Send InMail or DMs",
      "Scrape in bulk overnight",
    ],
    integrationSlugs: ["linkedin", "apollo", "hubspot", "gmail", "notion"],
    firstMessage:
      "Research these LinkedIn profiles for outreach. Draft notes. Do not send requests or messages.",
    faqs: [
      {
        q: "Will this get my account banned?",
        a: "We do not run spray automation. Research and drafts only until you click send.",
      },
    ],
  },
  {
    slug: "content-creation",
    category: "marketing",
    title: "Content creation",
    kicker: "Drafts in your voice",
    lede: "Turn briefs, transcripts, and notes into blog, newsletter, and social drafts. Publish waits for you.",
    problem:
      "Content ops is a pile of docs and a blank CMS. You want drafts grounded in your sources — not generic AI paste.",
    whatTheBotDoes: [
      "Read the brief, transcript, or Notion doc you name.",
      "Draft long-form and channel cutdowns in your voice notes.",
      "Leave CMS publish and social post buttons alone.",
    ],
    neverWithoutApproval: [
      "Publish to the CMS",
      "Post to social",
      "Email the list",
    ],
    integrationSlugs: [
      "notion",
      "googledocs",
      "webflow",
      "linkedin",
      "typefully",
    ],
    firstMessage:
      "Turn this transcript into a blog draft and three social cuts. Do not publish.",
    faqs: [
      {
        q: "Will it invent quotes?",
        a: "It sticks to the sources you give. Gaps stay marked as questions.",
      },
    ],
  },
  {
    slug: "social-scheduling",
    category: "marketing",
    title: "Social scheduling",
    kicker: "A teammate for Postiz, Post Bridge, and Typefully",
    lede: "Indie schedulers already exist. Whip Computer is the coworker who fills the calendar and never hits publish.",
    problem:
      "You already pay Postiz, Post Bridge, or Typefully. The work is still you sitting down every Sunday to write the week.",
    whatTheBotDoes: [
      "Turn a brief into drafts on Postiz or Post Bridge.",
      "Use Typefully or X when you want those queues instead.",
      "Leave posts as drafts or scheduled — publish stays yours.",
    ],
    neverWithoutApproval: [
      "Publish to any network",
      "Connect a new social account",
      "Change the handle",
    ],
    integrationSlugs: [
      "postiz",
      "post-bridge",
      "typefully",
      "instagram",
      "twitter",
      "linkedin",
    ],
    firstMessage:
      "Draft this week's posts for Postiz and Post Bridge from this brief. Do not publish.",
    faqs: [
      {
        q: "Postiz already has an agent. Why Whip Computer?",
        a: "Postiz drives Postiz. Whip Computer is the teammate that also has Gmail, GitHub, and a computer — one thread when the post needs a screenshot from the product.",
      },
      {
        q: "Postiz, Post Bridge, or Typefully?",
        a: "Any of them. Postiz and Post Bridge run on the Bot’s computer. Typefully and X connect under Plugins. You pick the calendar; publish still waits for you.",
      },
    ],
  },
  {
    slug: "paid-media",
    category: "marketing",
    title: "Paid media",
    kicker: "Numbers first. No live campaign edits.",
    lede: "Pull spend and results from the sources you name. Cite the sheet. Never change live campaigns.",
    problem:
      "The ad account is a loaded gun. You want yesterday's ROAS in Slack-quality prose, not a Bot with admin on Meta.",
    whatTheBotDoes: [
      "Read Google Ads, Meta, or the sheet you name.",
      "Cite spend, results, and the date range.",
      "Propose a change list. Do not click it live.",
    ],
    neverWithoutApproval: [
      "Change bids, budgets, or targeting",
      "Publish a new ad",
      "Pause a campaign",
    ],
    integrationSlugs: [
      "googleads",
      "facebook",
      "googlesheets",
      "datafast",
      "slack",
    ],
    firstMessage:
      "Pull spend and results for these campaigns. Cite the source. Do not change anything live.",
    faqs: [
      {
        q: "Can it pause a bleeding campaign?",
        a: "It can tell you to. It will not pause until you say so — even at 2am.",
      },
    ],
  },
  {
    slug: "ad-campaign-management",
    category: "marketing",
    title: "Ad campaign management",
    kicker: "Briefs and change lists, not live clicks",
    lede: "Build campaign briefs, creative variants, and a change checklist from performance. Live edits wait for you.",
    problem:
      "Campaign ops is briefs, creative, and a dangerous admin panel. You want the plan written before anyone clicks.",
    whatTheBotDoes: [
      "Read performance from Google Ads, Meta, or your sheet.",
      "Draft briefs, variants, and a prioritized change list.",
      "Stop before creating or editing live ads.",
    ],
    neverWithoutApproval: [
      "Create or edit live ads",
      "Spend budget",
      "Connect a new ad account",
    ],
    integrationSlugs: [
      "googleads",
      "facebook",
      "googledocs",
      "notion",
      "slack",
    ],
    firstMessage:
      "From last week’s ads, draft a campaign brief and change list. Do not edit live campaigns.",
    faqs: [
      {
        q: "How is this different from paid media?",
        a: "Paid media is the scoreboard. This job is the brief and the change plan that follows.",
      },
    ],
  },
  {
    slug: "competitor-analysis",
    category: "marketing",
    title: "Competitor analysis",
    kicker: "Watch the field. Cite sources.",
    lede: "Track competitor pages, pricing, and launches you name. Brief you with sources. Never post as you.",
    problem:
      "Competitive intel is bookmarks and rumor. You want a dated brief with links.",
    whatTheBotDoes: [
      "Fetch the competitor URLs and sources you name.",
      "Diff pricing, product, and hiring signals.",
      "Write a sourced brief. Do not publish or email outward.",
    ],
    neverWithoutApproval: [
      "Publish a teardown",
      "Email the competitor or prospect",
      "Change your public pricing page",
    ],
    integrationSlugs: [
      "notion",
      "googledocs",
      "slack",
      "linkedin",
      "twitter",
    ],
    firstMessage:
      "Compare these competitor pages to last month. Pricing and product changes with links. Do not publish.",
    faqs: [
      {
        q: "Is this a monitoring SaaS?",
        a: "No. It is a Bot with a computer and your watchlist. You keep the brief in Whip Computer.",
      },
    ],
  },
  {
    slug: "brand-monitoring",
    category: "marketing",
    title: "Brand monitoring",
    kicker: "Mentions with receipts",
    lede: "Watch the mentions and keywords you name. Summarize sentiment with links. Do not reply in public until you approve.",
    problem:
      "Brand mentions scatter across X, LinkedIn, Reddit, and support. You need a digest, not another alert firehose.",
    whatTheBotDoes: [
      "Search the sources and keywords you approve.",
      "Cluster themes with links and tone.",
      "Draft replies. Leave posting to you.",
    ],
    neverWithoutApproval: [
      "Reply in public",
      "DM strangers",
      "Delete or hide comments",
    ],
    integrationSlugs: ["twitter", "linkedin", "slack", "gmail", "notion"],
    firstMessage:
      "Scan mentions of our brand this week. Themes with links. Draft replies. Do not post.",
    faqs: [
      {
        q: "Will it auto-reply to hate?",
        a: "No. Drafts only. You own every public response.",
      },
    ],
  },
  {
    slug: "marketing-ops",
    category: "marketing",
    title: "Marketing ops",
    kicker: "UTMs, assets, and the weekly plan",
    lede: "Keep campaign naming, UTMs, and asset lists clean. Propose the weekly plan. Do not ship live tags without you.",
    problem:
      "Marketing ops dies in sheets and Slack threads. Someone has to keep the taxonomy honest.",
    whatTheBotDoes: [
      "Audit UTM and naming conventions in the sheet you name.",
      "Flag broken links and missing assets.",
      "Draft the weekly ops plan. Leave live tag changes to you.",
    ],
    neverWithoutApproval: [
      "Change production tracking",
      "Publish pages",
      "Spend ad budget",
    ],
    integrationSlugs: [
      "googlesheets",
      "google_analytics",
      "notion",
      "slack",
      "webflow",
    ],
    firstMessage:
      "Audit this UTM sheet and asset list. Flag issues and draft the weekly ops plan. Do not change live tags.",
    faqs: [
      {
        q: "Can it build UTMs?",
        a: "Yes — as a sheet or draft. It will not paste them into production without you.",
      },
    ],
  },
  {
    slug: "seo-automation",
    category: "seo",
    title: "SEO automation",
    kicker: "The SEO desk in one thread",
    lede: "Keyword gaps, page audits, and refresh lists from the tools you connect. No silent CMS publishes.",
    problem:
      "SEO is six tools and a backlog. You want a Bot that pulls the stack into one prioritized memo.",
    whatTheBotDoes: [
      "Pull Semrush, Ahrefs, Search Console, or the sheets you name.",
      "Rank opportunities and refresh candidates with evidence.",
      "Draft briefs. Do not publish pages.",
    ],
    neverWithoutApproval: [
      "Publish or unpublish pages",
      "Change production redirects",
      "Buy links",
    ],
    integrationSlugs: [
      "semrush",
      "ahrefs",
      "googlesheets",
      "webflow",
      "notion",
    ],
    firstMessage:
      "From Semrush and our sitemap, list the top SEO opportunities this month. Do not publish anything.",
    faqs: [
      {
        q: "Does this replace Semrush?",
        a: "No. Semrush stays the data. The Bot is the analyst who writes the plan.",
      },
    ],
  },
  {
    slug: "seo-content-brief",
    category: "seo",
    title: "SEO content brief",
    kicker: "Keyword to writer-ready brief",
    lede: "Turn a keyword into outline, SERP notes, and internal links. The CMS stays untouched.",
    problem:
      "Writers wait on briefs. Briefs wait on someone opening twelve tabs.",
    whatTheBotDoes: [
      "Research the keyword and top SERP results you care about.",
      "Draft outline, angle, FAQs, and internal link targets.",
      "Stop before drafting the full post unless you ask.",
    ],
    neverWithoutApproval: ["Publish", "Rewrite live pages", "Buy tools"],
    integrationSlugs: ["ahrefs", "semrush", "notion", "googledocs", "webflow"],
    firstMessage:
      "Write an SEO brief for this keyword. Outline, SERP notes, internal links. Do not publish.",
    faqs: [
      {
        q: "Will it write the full article?",
        a: "Only if you ask. Default is the brief so a human (or another Bot) can draft.",
      },
    ],
  },
  {
    slug: "seo-content-refresh",
    category: "seo",
    title: "SEO content refresh",
    kicker: "Win back decaying pages",
    lede: "Find pages losing traffic. Propose refresh diffs with sources. Do not ship edits live.",
    problem:
      "Old posts rot quietly. You need a refresh queue with concrete edits, not a vibe.",
    whatTheBotDoes: [
      "Compare traffic and rankings for the URLs you name.",
      "Propose section-level refreshes and new FAQs.",
      "Leave CMS edits parked until you approve.",
    ],
    neverWithoutApproval: [
      "Edit live pages",
      "Change titles or redirects",
      "Delete content",
    ],
    integrationSlugs: [
      "google_analytics",
      "ahrefs",
      "webflow",
      "notion",
      "googledocs",
    ],
    firstMessage:
      "Find decaying posts and propose refreshes with evidence. Do not edit live pages.",
    faqs: [
      {
        q: "How many pages at once?",
        a: "Name a set or a date range. It ranks by impact, then waits for your go.",
      },
    ],
  },
  {
    slug: "keyword-research",
    category: "seo",
    title: "Keyword research",
    kicker: "Clusters with intent, not a dump",
    lede: "Build keyword clusters from the seed terms you name. Map intent and difficulty. No auto-content farm.",
    problem:
      "Keyword exports are noise. You need clusters tied to pages you can actually ship.",
    whatTheBotDoes: [
      "Expand seeds in Ahrefs, Semrush, or the sheet you paste.",
      "Cluster by intent and map to existing URLs.",
      "Flag gaps. Do not generate spam pages.",
    ],
    neverWithoutApproval: [
      "Publish programmatic pages",
      "Buy keyword tools",
      "Change site architecture live",
    ],
    integrationSlugs: ["ahrefs", "semrush", "googlesheets", "notion", "slack"],
    firstMessage:
      "Cluster keywords from these seeds. Map to existing pages and gaps. Do not publish.",
    faqs: [
      {
        q: "Programmatic SEO?",
        a: "It can propose a page map. It will not mass-publish thin pages.",
      },
    ],
  },
  {
    slug: "serp-analysis",
    category: "seo",
    title: "SERP analysis",
    kicker: "Who you are up against",
    lede: "Break down the SERP for the queries you name. Formats, gaps, and angle. Cite the live results.",
    problem:
      "You know the keyword. You do not know why the top five win.",
    whatTheBotDoes: [
      "Fetch and summarize the current SERP for each query.",
      "Note formats, entities, and content gaps.",
      "Recommend an angle. Do not publish a page.",
    ],
    neverWithoutApproval: ["Publish", "Buy backlinks", "Impersonate a brand"],
    integrationSlugs: ["ahrefs", "semrush", "notion", "googledocs", "slack"],
    firstMessage:
      "Analyze the SERP for these queries. Formats, gaps, recommended angle. Do not publish.",
    faqs: [
      {
        q: "Is the SERP live?",
        a: "It uses the computer and your SEO tools. Always check the date on the brief.",
      },
    ],
  },
  {
    slug: "utm-builder",
    category: "seo",
    title: "UTM builder",
    kicker: "Clean campaign data",
    lede: "Generate consistent UTM links from your naming rules. Export a sheet. Do not rewrite production URLs without you.",
    problem:
      "UTM chaos ruins attribution. Someone has to enforce the taxonomy every launch.",
    whatTheBotDoes: [
      "Apply your naming rules to the campaigns you list.",
      "Output a sheet of final URLs.",
      "Flag collisions. Leave live links alone until you paste.",
    ],
    neverWithoutApproval: [
      "Change production pages",
      "Overwrite analytics filters",
      "Send the links externally",
    ],
    integrationSlugs: [
      "googlesheets",
      "google_analytics",
      "notion",
      "slack",
      "dub",
    ],
    firstMessage:
      "Build UTM links for this launch from our naming rules. Sheet only. Do not change live pages.",
    faqs: [
      {
        q: "Short links?",
        a: "It can draft Dub or other short links when connected. You still approve create.",
      },
    ],
  },
  {
    slug: "chief-of-staff",
    category: "founder",
    title: "Chief of staff",
    kicker: "What changed. What needs you.",
    lede: "A source-linked digest of Slack, inbox, calendar, and notes — only the items that map to this week’s priorities. Does not send. Does not move meetings.",
    problem:
      "The week is scattered across Slack, Gmail, and a calendar. You need a brief, not another inbox.",
    whatTheBotDoes: [
      "Review approved channels, inbox, calendar, and meeting notes since yesterday.",
      "Return only items that map to the priorities you name.",
      "For each: source, why it matters, proposed next step, whether you owe a decision.",
    ],
    neverWithoutApproval: [
      "Send messages",
      "Change meetings",
      "Message anyone outside the thread",
    ],
    integrationSlugs: ["notion", "slack", "googlecalendar", "gmail", "linear"],
    firstMessage:
      "Review Slack, inbox, and calendar since yesterday. Only what maps to this week’s priorities. Do not send messages or change meetings.",
    faqs: [
      {
        q: "Is this an orchestration canvas?",
        a: "No. It is a person in the sidebar. You hire a Chief of Staff, then specialists — inbox, expenses, recruiting. You message one Bot. It files the week.",
      },
    ],
  },
  {
    slug: "expense-manager",
    category: "operations",
    title: "Expense manager",
    kicker: "Receipts in. Policy out. No payments.",
    lede: "Read receipts and statements. Flag anything over policy. Never submit or pay. Return a table of exceptions.",
    problem:
      "The pile is PDFs, Stripe, and a card statement. You need exceptions, not another finance SaaS.",
    whatTheBotDoes: [
      "Read the files and the Stripe/Polar/Zenvoice views you name.",
      "Flag over policy. Table: amount, vendor, why it is weird.",
      "Never submit an expense report or pay a bill.",
    ],
    neverWithoutApproval: ["Submit expenses", "Pay or refund", "File taxes"],
    integrationSlugs: ["stripe", "polar", "zenvoice", "gmail", "googledrive"],
    firstMessage:
      "Read these receipts against policy. Table of exceptions. Do not submit or pay.",
    faqs: [
      {
        q: "Does it log into the bank?",
        a: "Only if you open that on the computer and stay for 2FA. It still will not move money.",
      },
    ],
  },
  {
    slug: "invoice-processing",
    category: "operations",
    title: "Invoice processing",
    kicker: "Extract. Match. You approve pay.",
    lede: "Pull fields from invoices you share. Match to vendors and POs. Never pay or file taxes.",
    problem:
      "Invoices land as PDF chaos. You need structured rows and exceptions, not auto-pay.",
    whatTheBotDoes: [
      "Extract vendor, amount, due date, and line items.",
      "Match against the sheet or Stripe/Polar view you name.",
      "Flag mismatches. Stop before payment.",
    ],
    neverWithoutApproval: ["Pay invoices", "Change bank details", "File taxes"],
    integrationSlugs: ["gmail", "googledrive", "stripe", "polar", "googlesheets"],
    firstMessage:
      "Extract these invoices into a table and flag mismatches. Do not pay.",
    faqs: [
      {
        q: "Can it push to QuickBooks?",
        a: "It can draft the export. Accounting writes wait for your approval.",
      },
    ],
  },
  {
    slug: "sheets-ops",
    category: "operations",
    title: "Google Sheets ops",
    kicker: "Spreadsheets from chat",
    lede: "Clean, join, and summarize the sheets you name. Propose formulas. Do not overwrite production tabs without you.",
    problem:
      "The company still runs on sheets. You want ops help without a Bot silently nuking rows.",
    whatTheBotDoes: [
      "Read the tabs you name.",
      "Clean, join, and summarize with citations to ranges.",
      "Propose formula or schema changes. Wait for write approval.",
    ],
    neverWithoutApproval: [
      "Overwrite production tabs",
      "Delete rows in bulk",
      "Share the sheet externally",
    ],
    integrationSlugs: [
      "googlesheets",
      "googledrive",
      "slack",
      "notion",
      "airtable",
    ],
    firstMessage:
      "Clean this sheet and summarize anomalies. Propose fixes. Do not overwrite until I say so.",
    faqs: [
      {
        q: "Airtable too?",
        a: "Yes when connected. Same rule: read first, write only with approval.",
      },
    ],
  },
  {
    slug: "shopify-ops",
    category: "operations",
    title: "Shopify ops",
    kicker: "Store brief, not store autopilot",
    lede: "Pull orders, inventory risks, and merchandising notes. Draft changes. Never alter live catalog or refunds without you.",
    problem:
      "Shopify admin is deep. You want a morning brief and a change list, not an agent with refund powers.",
    whatTheBotDoes: [
      "Read orders, inventory, and the reports you name.",
      "Flag stockouts, odd refunds, and campaign candidates.",
      "Draft product copy or price changes. Stop before live edits.",
    ],
    neverWithoutApproval: [
      "Change prices or inventory",
      "Issue refunds",
      "Publish theme edits",
    ],
    integrationSlugs: ["shopify", "stripe", "gmail", "slack", "googlesheets"],
    firstMessage:
      "Morning Shopify brief: orders, inventory risks, odd refunds. Do not change the store.",
    faqs: [
      {
        q: "Can it write product copy?",
        a: "Yes as drafts. Live catalog writes wait for you.",
      },
    ],
  },
  {
    slug: "talent-scout",
    category: "operations",
    title: "Talent scout",
    kicker: "A sourcer who does not email anyone",
    lede: "Source candidates from the brief. Never email anyone without approval. End with a shortlist and why.",
    problem:
      "Sourcing is tabs: LinkedIn, the ATS, the doc. You want a shortlist, not a Bot sliding into DMs.",
    whatTheBotDoes: [
      "Read the brief. Search the sources you name.",
      "Write a shortlist: why them, why not, links.",
      "Stop before LinkedIn or Gmail sends.",
    ],
    neverWithoutApproval: [
      "Email or InMail a candidate",
      "Change ATS stage",
      "Reject someone",
    ],
    integrationSlugs: ["linkedin", "gmail", "notion", "airtable", "googlecalendar"],
    firstMessage:
      "Source candidates from this brief. Shortlist of 8 with why. Do not email anyone.",
    faqs: [
      {
        q: "Will it spam LinkedIn?",
        a: "No. It reads and writes a memo. Outreach waits for you.",
      },
    ],
  },
  {
    slug: "indie-stack",
    category: "founder",
    title: "Indie hacker stack",
    kicker: "Marc Lou, Jack Friks, and the rest of Twitter",
    lede: "DataFast for revenue, Postiz or Post Bridge for posts, Polar or Stripe for money. One Bot, no Zapier cartoon.",
    problem:
      "The indie stack is ten tabs: analytics, scheduler, payments, GitHub, Gmail. You do not want a workflow builder. You want a coworker.",
    whatTheBotDoes: [
      "Open DataFast for what made money.",
      "Draft the week's posts in Postiz or Post Bridge.",
      "Check Polar/Stripe and GitHub. One memo. Nothing live without you.",
    ],
    neverWithoutApproval: [
      "Publish social",
      "Change prices",
      "Tweet as you",
    ],
    integrationSlugs: [
      "datafast",
      "postiz",
      "post-bridge",
      "polar",
      "stripe",
      "twitter",
      "github",
    ],
    firstMessage:
      "Indie stack check: DataFast revenue, Postiz drafts, Polar orders, GitHub shipped. Do not publish or change prices.",
    faqs: [
      {
        q: "Which indie products are first-class?",
        a: "DataFast, Postiz, Post Bridge, ShipFast, TrustMRR, Zenvoice, ByeDispute, Indie Page, and Polar. Gmail, GitHub, Typefully, Stripe, and hundreds more connect under Plugins.",
      },
      {
        q: "Do I need every connector?",
        a: "No. The computer covers tools that aren’t connected yet. Connect the rest when a Bot hits a wall.",
      },
    ],
  },
  {
    slug: "inbox-triage",
    category: "support",
    title: "Inbox triage",
    kicker: "Gmail without the guilt",
    lede: "Sort the pile. Draft the replies. Never send. The inbox is still yours.",
    problem:
      "Support, founders, and sales all land in one Gmail. You need a triage, not auto-send.",
    whatTheBotDoes: [
      "Fetch unread from Gmail or Outlook for the labels you name.",
      "Bucket: reply, wait, archive. Draft the replies.",
      "Do not send, delete, or auto-forward.",
    ],
    neverWithoutApproval: ["Send", "Delete in bulk", "Change forwarding"],
    integrationSlugs: ["gmail", "outlook", "googlecalendar", "slack", "linear"],
    firstMessage:
      "Triage unread from yesterday. Draft replies. Do not send.",
    faqs: [
      {
        q: "Does it need Gmail connected?",
        a: "Gmail and Outlook connect under Plugins. First tasks can still be a file summary with no connector.",
      },
    ],
  },
  {
    slug: "support-triage",
    category: "support",
    title: "Support triage",
    kicker: "Tickets to action",
    lede: "Cluster bugs and feedback from Zendesk, Intercom, or Linear. Draft replies and issue notes. Do not close tickets without you.",
    problem:
      "Support is a firehose. Engineering wants themes. Customers want replies that sound human.",
    whatTheBotDoes: [
      "Read the queues you name.",
      "Cluster themes and severity with ticket links.",
      "Draft customer replies and engineering notes. Leave status yours.",
    ],
    neverWithoutApproval: [
      "Send customer replies",
      "Close or delete tickets",
      "Issue refunds",
    ],
    integrationSlugs: ["zendesk", "intercom", "linear", "slack", "github"],
    firstMessage:
      "Triage this support queue. Themes, severity, draft replies. Do not send or close.",
    faqs: [
      {
        q: "Will it auto-close duplicates?",
        a: "It flags them. Close stays a human click.",
      },
    ],
  },
  {
    slug: "data-analyst",
    category: "data",
    title: "Data analyst",
    kicker: "Questions with citations",
    lede: "Answer questions from the warehouses, sheets, and analytics you connect. Cite the query. Never change production dashboards.",
    problem:
      "Everyone asks 'what happened?' Nobody wants another Looker seat. You need answers with receipts.",
    whatTheBotDoes: [
      "Query the sources you name — sheets, analytics, Stripe.",
      "Answer with numbers and source citations.",
      "Leave dashboards and pixels read-only.",
    ],
    neverWithoutApproval: [
      "Edit tracking",
      "Change dashboards",
      "Export customer PII externally",
    ],
    integrationSlugs: [
      "googlesheets",
      "google_analytics",
      "stripe",
      "mixpanel",
      "slack",
    ],
    firstMessage:
      "What drove revenue this week? Cite sources. Do not change dashboards.",
    faqs: [
      {
        q: "Warehouse?",
        a: "Sheets and product analytics first. Point it at a warehouse UI on the computer when you need deeper pulls.",
      },
    ],
  },
  {
    slug: "founder-analytics",
    category: "founder",
    title: "Founder analytics",
    kicker: "DataFast, not a BI warehouse",
    lede: "Pull the numbers you name. Cite the source. Never change production dashboards. Five bullets, then open questions.",
    problem:
      "GA4 is a maze. You bought DataFast to see which tweets made money. You still spend Monday reconstructing the week.",
    whatTheBotDoes: [
      "Read DataFast (computer) plus Stripe, Polar, or Google Analytics when connected.",
      "Answer 'what actually converted' with citations.",
      "Leave pixels and goals untouched.",
    ],
    neverWithoutApproval: [
      "Edit tracking",
      "Change dashboards",
      "Refund or alter Stripe/Polar products",
    ],
    integrationSlugs: [
      "datafast",
      "stripe",
      "polar",
      "google_analytics",
      "plausible_analytics",
      "mixpanel",
    ],
    firstMessage:
      "From DataFast and Stripe, what drove paying customers this week? Cite sources. Do not change dashboards.",
    faqs: [
      {
        q: "Does this replace DataFast?",
        a: "No. DataFast stays the source of truth. The Bot is the analyst who opens it and writes the memo.",
      },
      {
        q: "Marc Lou's other products?",
        a: "ShipFast, TrustMRR, Zenvoice, ByeDispute, and Indie Page have their own integration pages. Analytics work starts here.",
      },
    ],
  },
  {
    slug: "web-research",
    category: "data",
    title: "Web research",
    kicker: "Clean, sourced notes from the open web",
    lede: "Turn URLs and questions into sourced notes. Cite every claim. Do not publish or email the brief outward.",
    problem:
      "Research dies in browser tabs. You want a memo with links, not a hallucination essay.",
    whatTheBotDoes: [
      "Fetch the pages and queries you name.",
      "Extract facts with source URLs.",
      "Write a structured brief. Leave publishing to you.",
    ],
    neverWithoutApproval: [
      "Publish the brief",
      "Email third parties",
      "Create accounts on sites",
    ],
    integrationSlugs: ["notion", "googledocs", "slack", "apify", "gmail"],
    firstMessage:
      "Research this question from these URLs. Sourced notes only. Do not publish.",
    faqs: [
      {
        q: "Scraping at scale?",
        a: "It uses the computer and tools like Apify when connected. You set the scope; it does not run unbounded crawls.",
      },
    ],
  },
  {
    slug: "bug-reproduction",
    category: "engineering",
    title: "Bug reproduction",
    kicker: "A computer, a ticket, a fixture",
    lede: "Reproduce the bug from the report. Write steps, expected vs actual, and a minimal fixture. Do not change production.",
    problem:
      "The ticket says 'doesn't work'. Someone has to actually click it. That someone can be a Bot with a computer.",
    whatTheBotDoes: [
      "Open Linear, GitHub, or Jira for the issue you name.",
      "Reproduce on the computer. Screenshot. Write steps.",
      "Draft a fixture. Do not patch production.",
    ],
    neverWithoutApproval: [
      "Merge or deploy",
      "Change production",
      "Close the issue",
    ],
    integrationSlugs: ["linear", "github", "jira", "notion", "slack"],
    firstMessage:
      "Reproduce this bug. Steps, expected vs actual, screenshot. Do not change production.",
    faqs: [
      {
        q: "Why not just Copilot?",
        a: "Copilot edits code. This Bot has a computer and the ticket. It clicks the product, then writes the fixture.",
      },
    ],
  },
  {
    slug: "shipping-updates",
    category: "engineering",
    title: "Shipping updates",
    kicker: "GitHub and Linear, in English",
    lede: "What shipped, what is stuck, what needs you. No merge, no deploy.",
    problem:
      "The changelog is a PR list. The team wants a paragraph.",
    whatTheBotDoes: [
      "Read GitHub and Linear for the range you name.",
      "Write shipped / stuck / needs a human.",
      "Draft the customer-facing note. Do not publish it.",
    ],
    neverWithoutApproval: ["Merge", "Deploy", "Close issues"],
    integrationSlugs: ["github", "linear", "jira", "slack", "notion"],
    firstMessage:
      "What shipped this week in GitHub and Linear? Stuck vs needs me. Do not merge or close.",
    faqs: [
      {
        q: "Can it review a PR?",
        a: "It can read the diff and comment in the Bot thread. It will not approve or merge until you say so.",
      },
    ],
  },
  {
    slug: "salesforce-ops",
    category: "sales",
    title: "Salesforce ops",
    kicker: "Salesforce from chat — writes gated",
    lede: "Query objects, draft reports, and propose field updates. Never mass-update or delete without you.",
    problem:
      "Salesforce is powerful and slow. Reps want answers in chat without admin rights on the Bot.",
    whatTheBotDoes: [
      "Query the objects and reports you name.",
      "Summarize pipeline and hygiene issues.",
      "Draft updates. Stop before mass writes.",
    ],
    neverWithoutApproval: [
      "Mass update or delete records",
      "Change permissions",
      "Email contacts from Salesforce",
    ],
    integrationSlugs: ["salesforce", "slack", "gmail", "notion", "googlesheets"],
    firstMessage:
      "Query these Salesforce reports and flag hygiene issues. Propose fixes. Do not mass-update.",
    faqs: [
      {
        q: "Admin access?",
        a: "Connect least privilege. The product rule is still: propose writes, wait for you.",
      },
    ],
  },
];
