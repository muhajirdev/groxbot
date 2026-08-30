import type { AvatarShape } from "@groxbot/contracts";

export const AVATAR_COLORS = [
  "#e45c9a",
  "#5b7cff",
  "#e25d4a",
  "#2f9e6d",
  "#d9a441",
  "#8b6ccf",
  "#d46aa0",
  "#3aa0b8",
  "#4d5568",
] as const;

export const AVATAR_SHAPES: AvatarShape[] = [
  "circle",
  "squircle",
  "diamond",
  "triangle",
  "hex",
];

export const SUGGESTED_JOBS = [
  {
    title: "Chief of Staff",
    description:
      "Turn messy notes into decisions, owners, and dates. Stop if you would need to message anyone outside.",
  },
  {
    title: "Talent Scout",
    description:
      "Source candidates from the brief. Never email anyone without my approval. End with a shortlist and why.",
  },
  {
    title: "Expense Manager",
    description:
      "Read receipts and statements. Flag anything over policy. Never submit or pay. Return a table of exceptions.",
  },
  {
    title: "Bug Reproduction",
    description:
      "Reproduce the bug from the report. Write steps, expected vs actual, and a minimal fixture. Do not change production.",
  },
  {
    title: "Product Performance",
    description:
      "Pull the numbers I name. Cite the source. Never change production dashboards. Five bullets, then open questions.",
  },
  {
    title: "Sales Outbound",
    description:
      "Draft follow-ups from the account list. Do not send mail. Ask before anything leaves this thread.",
  },
] as const;

export const FIRST_HIRE = SUGGESTED_JOBS[0];

export const FIRST_TASK =
  "Summarize this conversation starter in five bullets. List every date, decision, and open question. Do not invent sources.";
