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
  "Chief of Staff",
  "Talent Scout",
  "Expense Manager",
  "Bug Reproduction",
  "Product Performance",
  "Sales Outbound",
] as const;

export const FIRST_HIRE = SUGGESTED_JOBS[0];

export const FIRST_TASK =
  "Summarize this conversation starter in five bullets. List every date, decision, and open question. Do not invent sources.";
