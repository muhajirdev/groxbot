import { PRO_TRIAL_INTERVAL_COUNT } from "@groxbot/contracts";

export type PricingPlan = {
  id: "pro" | "plus" | "believers";
  name: string;
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
    blurb: "AI for your team.",
    cta: "Request an invite",
    note: `Invite only · then a ${PRO_TRIAL_INTERVAL_COUNT}-day trial on hosted whip.computer`,
    features: [
      "Teammates with a computer",
      "Knowledge that grows as you work",
      "Plugins",
      "Hosted models included",
      "Live apps",
      "Mobile — coming soon",
    ],
  },
  {
    id: "plus",
    name: "Pro Plus",
    blurb: "Everything in Pro, plus frontier models.",
    cta: "Request an invite",
    note: "Everything in Pro",
    popular: true,
    features: ["Frontier models (GPT-6 Astra, Claude Fable 5.1, …)"],
  },
  {
    id: "believers",
    name: "Believers",
    blurb: "Keep us independent. Get early access.",
    cta: "Request an invite",
    note: "Everything in Pro Plus · keeps us independent",
    features: [
      "More hosted model usage",
      "Early access to new features",
      "A direct line when something’s off",
    ],
  },
];

export const PRICING_FAQS = [
  {
    q: "Is self-host free?",
    a: "Yes. Run Whip Computer on your own machines with your own keys. Hosted whip.computer is the paid product.",
  },
  {
    q: "Do seats multiply the price?",
    a: "No. Workspace plans are flat for the team. You’ll see hosted prices in the app when you subscribe.",
  },
];
