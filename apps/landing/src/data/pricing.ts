import {
  PRO_TRIAL_INTERVAL_COUNT,
  WORKSPACE_PLAN_BELIEVERS,
  WORKSPACE_PLAN_PLUS,
  WORKSPACE_PLAN_PRICE_USD,
  WORKSPACE_PLAN_PRO,
} from "@groxbot/contracts";

export type PricingPlan = {
  id: "pro" | "plus" | "believers";
  name: string;
  monthly: number;
  yearly: number;
  blurb: string;
  cta: string;
  note: string;
  features: string[];
  popular?: boolean;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "pro",
    name: "Pro",
    monthly: WORKSPACE_PLAN_PRICE_USD[WORKSPACE_PLAN_PRO].month,
    yearly: WORKSPACE_PLAN_PRICE_USD[WORKSPACE_PLAN_PRO].year,
    blurb: "The office for your team.",
    cta: "Start free trial",
    note: `${PRO_TRIAL_INTERVAL_COUNT}-day trial on hosted groxbot.com`,
    features: [
      "Teammates with a computer",
      "Knowledge that grows as you work",
      "Plugins",
      "$20 hosted models / month",
      "Live apps — coming soon",
      "Mobile — coming soon",
    ],
  },
  {
    id: "plus",
    name: "Pro Plus",
    monthly: WORKSPACE_PLAN_PRICE_USD[WORKSPACE_PLAN_PLUS].month,
    yearly: WORKSPACE_PLAN_PRICE_USD[WORKSPACE_PLAN_PLUS].year,
    blurb: "Everything in Pro, plus frontier models.",
    cta: "Subscribe",
    note: "Everything in Pro",
    popular: true,
    features: ["Frontier models (GPT-6 Astra, Claude Fable 5.1, …)"],
  },
  {
    id: "believers",
    name: "Believers",
    monthly: WORKSPACE_PLAN_PRICE_USD[WORKSPACE_PLAN_BELIEVERS].month,
    yearly: WORKSPACE_PLAN_PRICE_USD[WORKSPACE_PLAN_BELIEVERS].year,
    blurb: "Keep us independent. Get early access.",
    cta: "Become a Believer",
    note: "Everything in Pro Plus · keeps us independent",
    features: [
      "$100 hosted models / month",
      "Early access to new features",
      "A direct line when something’s off",
    ],
  },
];

export const PRICING_FAQS = [
  {
    q: "Is self-host free?",
    a: "Yes. Run Groxbot on your own machines with your own keys. Hosted groxbot.com is the paid product.",
  },
  {
    q: "What does annual billing save?",
    a: "Annual is priced as 10 months — two months free.",
  },
  {
    q: "Do seats multiply the price?",
    a: "No. Workspace plans are flat for the office. Compare that to per-seat lab tools on the pricing page.",
  },
];
