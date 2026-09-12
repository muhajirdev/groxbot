export type IndieIntegration = {
  slug: string;
  name: string;
  productUrl: string;
  founder: string;
  category: string;
  description: string;
  featured: boolean;
  how: string[];
  neverWithoutApproval: string[];
  firstMessage: string;
  faqs: Array<{ q: string; a: string }>;
};

export const INDIE_INTEGRATIONS: IndieIntegration[] = [
  {
    slug: "datafast",
    name: "DataFast",
    productUrl: "https://datafa.st",
    founder: "Marc Lou",
    category: "analytics",
    featured: true,
    description:
      "Revenue analytics for indie founders. DataFast shows which channels bring paying customers, not just pageviews — Stripe, Polar, and Lemon Squeezy on top of traffic.",
    how: [
      "Open DataFast on the computer and pull the channels that actually converted this week.",
      "Cite the property, date range, and revenue number. No vanity traffic.",
      "Draft a 'what to double down on' note. Never change pixels, goals, or domains.",
    ],
    neverWithoutApproval: [
      "Edit tracking snippets or goals",
      "Add or remove a site",
      "Invite teammates",
    ],
    firstMessage:
      "From DataFast, which channels made paying customers this week? Cite the source. Do not change dashboards.",
    faqs: [
      {
        q: "Is there a DataFast plugin?",
        a: "Not today. Whip Computer still works: the Bot uses the computer, logs into datafa.st the way you would, and brings numbers back to the thread. Marc Lou also ships a DataFast API and MCP — connect those when you want API-level reads.",
      },
      {
        q: "Can it see Stripe revenue in DataFast?",
        a: "If you already connected Stripe (or Polar / Lemon Squeezy) in DataFast, the Bot can read what you can see. It will not reconnect billing or invent attribution.",
      },
    ],
  },
  {
    slug: "postiz",
    name: "Postiz",
    productUrl: "https://postiz.com",
    founder: "Nevo David",
    category: "social media marketing",
    featured: true,
    description:
      "Open-source, agentic social scheduler. Postiz plans, generates, and queues posts across 30+ networks — with a public API, MCP, and a calendar you can actually review.",
    how: [
      "Draft posts from the brief and drop them on the Postiz calendar as drafts.",
      "Use the computer when the calendar needs a human look. You still hit publish.",
      "If Postiz is self-hosted, the Bot works in your instance the same way.",
    ],
    neverWithoutApproval: [
      "Publish to any network",
      "Connect or disconnect a social account",
      "Spend Postiz AI image/video credits you did not name",
    ],
    firstMessage:
      "Draft this week's posts in Postiz from the brief. Leave them as drafts. Do not publish.",
    faqs: [
      {
        q: "Does Whip Computer replace Postiz's own agent?",
        a: "No. Postiz already speaks MCP and CLI. Whip Computer is the teammate with a computer: it can drive Postiz, Gmail, and GitHub in one thread, then stop when something would go live.",
      },
      {
        q: "Self-hosted Postiz?",
        a: "Yes. Point the computer at your instance. Same rule: drafts in the calendar, publish stays yours.",
      },
    ],
  },
  {
    slug: "post-bridge",
    name: "Post Bridge",
    productUrl: "https://www.post-bridge.com",
    founder: "Jack Friks",
    category: "social media marketing",
    featured: true,
    description:
      "Cross-post once, sit on every network. Post Bridge is Jack Friks' scheduler for people who want unlimited posts without an agency stack.",
    how: [
      "Prepare the week's posts in Post Bridge from the brief you paste in chat.",
      "Keep everything scheduled or drafted. The Bot does not smash publish on X for you.",
      "If a network needs a fresh login or 2FA, it stops on the computer.",
    ],
    neverWithoutApproval: [
      "Publish or send a scheduled post early",
      "Disconnect a social account",
      "Change billing",
    ],
    firstMessage:
      "Load these posts into Post Bridge for the week. Do not publish. Ask if a network is missing.",
    faqs: [
      {
        q: "Does Post Bridge need a plugin?",
        a: "No. This is a computer integration: the Bot uses post-bridge.com like a coworker with a monitor. Fine for indie stacks that Zapier never bothered to list.",
      },
      {
        q: "Post Bridge vs Postiz?",
        a: "Post Bridge is the simple cross-poster. Postiz is the open-source agentic calendar. Whip Computer will drive either. You pick the tool; the Bot asks before anything goes live.",
      },
    ],
  },
  {
    slug: "shipfast",
    name: "ShipFast",
    productUrl: "https://shipfa.st",
    founder: "Marc Lou",
    category: "developer tools",
    featured: true,
    description:
      "Marc Lou's Next.js boilerplate for shipping a SaaS in days: auth, payments, SEO, and the boring setup already wired.",
    how: [
      "Open the ShipFast repo or starter on the computer. Fill env from the secrets you name.",
      "Run the local app, click the happy path, write down what is still TODO.",
      "Never push to production or spend on a new vendor without you.",
    ],
    neverWithoutApproval: [
      "Push or deploy",
      "Create a paid Stripe/Polar product",
      "Change production env",
    ],
    firstMessage:
      "Clone ShipFast, fill the env keys I named, and run it locally. Do not deploy.",
    faqs: [
      {
        q: "Why would a Bot need ShipFast?",
        a: "Because the first week of a SaaS is errands: env, Stripe, auth callbacks. A Bot with a computer can grind that while you write the actual product.",
      },
    ],
  },
  {
    slug: "trustmrr",
    name: "TrustMRR",
    productUrl: "https://trustmrr.com",
    founder: "Marc Lou",
    category: "analytics",
    featured: false,
    description:
      "Verified startup revenue and acquisitions. TrustMRR is Marc Lou's marketplace for numbers you can actually check.",
    how: [
      "Search TrustMRR for the niche you name. Return listings with verified MRR, not screenshots from Twitter.",
      "Draft a shortlist: price, multiple, what looks off. Do not contact a seller.",
      "If a listing needs an account, it stops for login.",
    ],
    neverWithoutApproval: [
      "Message a seller or buyer",
      "Place an offer",
      "Pay an acquisition fee",
    ],
    firstMessage:
      "Find TrustMRR listings in this niche. Table: MRR, asking, notes. Do not contact anyone.",
    faqs: [
      {
        q: "Can the Bot buy a startup?",
        a: "No. It reads the marketplace and writes a memo. Offers, fees, and DMs stay yours.",
      },
    ],
  },
  {
    slug: "zenvoice",
    name: "Zenvoice",
    productUrl: "https://zenvoice.io",
    founder: "Marc Lou",
    category: "accounting",
    featured: false,
    description:
      "Stripe invoicing without the accounting theater. Zenvoice is Marc Lou's tool for people who just need to send a clean invoice.",
    how: [
      "Draft the invoice in Zenvoice from the line items you name.",
      "Leave it unsent. You click send.",
      "Flag anything over policy before it goes out.",
    ],
    neverWithoutApproval: ["Send an invoice", "Change Stripe payout settings"],
    firstMessage:
      "Draft this invoice in Zenvoice. Do not send. Ask if a line item is missing.",
    faqs: [
      {
        q: "Will it charge the customer?",
        a: "Not until you send. The Bot drafts. Stripe still waits on you.",
      },
    ],
  },
  {
    slug: "byedispute",
    name: "ByeDispute",
    productUrl: "https://byedispute.com",
    founder: "Marc Lou",
    category: "payment processing",
    featured: false,
    description:
      "Stripe chargeback helper. ByeDispute gathers evidence so a dispute does not eat the afternoon.",
    how: [
      "Read the open disputes. Draft evidence from the sources you name.",
      "Never submit to Stripe until you review the packet.",
      "If a deadline is close, it says so in the first line.",
    ],
    neverWithoutApproval: ["Submit dispute evidence", "Issue a refund"],
    firstMessage:
      "List open ByeDispute / Stripe disputes. Draft evidence. Do not submit.",
    faqs: [
      {
        q: "Is this legal advice?",
        a: "No. The Bot compiles what you already have. You still own the submission.",
      },
    ],
  },
  {
    slug: "indie-page",
    name: "Indie Page",
    productUrl: "https://indiepa.ge",
    founder: "Marc Lou",
    category: "website builders",
    featured: false,
    description:
      "A public page for indie makers — products, revenue, and the story in one URL. Marc Lou's link-in-bio for people who ship.",
    how: [
      "Draft copy and product blurbs for Indie Page from the notes you paste.",
      "Do not publish until you say the page is live-ready.",
      "Cite numbers only if you gave them. No invented MRR.",
    ],
    neverWithoutApproval: ["Publish the page", "Connect a custom domain"],
    firstMessage:
      "Draft Indie Page copy from these notes. Do not publish. Flag any number I did not give you.",
    faqs: [
      {
        q: "Can it fake revenue on the page?",
        a: "No. If a number is not in the thread or a source you named, it leaves a blank and asks.",
      },
    ],
  },
  {
    slug: "polar",
    name: "Polar",
    productUrl: "https://polar.sh",
    founder: "Polar",
    category: "payment processing",
    featured: true,
    description:
      "Merchant of record for indie hackers. Polar handles payments, payouts, and product pages so you are not wiring Stripe by hand.",
    how: [
      "Read Polar for orders, products, and payouts you name. Cite the org.",
      "Draft a product or price change. Never create a live product until you approve.",
      "Whip Computer's own billing research uses Polar at workspace grain — same caution here.",
    ],
    neverWithoutApproval: [
      "Create or archive a product",
      "Change prices",
      "Issue refunds",
    ],
    firstMessage:
      "Pull this week's Polar orders. Cite the org. Do not change products.",
    faqs: [
      {
        q: "Is Polar a plugin?",
        a: "Not as a listed plugin. The Bot uses the Polar dashboard on the computer, or Polar's API if you hand it a scoped key. Live price changes still wait for you.",
      },
    ],
  },
];
