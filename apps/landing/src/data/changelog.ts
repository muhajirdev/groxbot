export type ChangelogEntry = {
  date: string;
  title: string;
  body: string;
  href?: string;
};

/** Public product notes for the landing changelog. Keep factual; no vapor. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-09-07",
    title: "Use cases hub",
    body: "Expanded public use cases across sales, marketing, SEO, ops, support, data, and engineering — each with draft-only guardrails.",
    href: "/use-cases",
  },
  {
    date: "2026-09-05",
    title: "Bot marketplace packages",
    body: "Hire catalog listings ship as full teammate packages: soul, memory, and starter skills — same list in the product and on Templates.",
    href: "/templates",
  },
  {
    date: "2026-09-04",
    title: "Pi-native threads",
    body: "Turns run on the home RoomActor with streamed Cap’n Web. Computers stay on that bot’s desk.",
  },
  {
    date: "2026-09-03",
    title: "Knowledge as a library",
    body: "Workspace knowledge is one R2 tree. Skills are SKILL.md files. Search and backlinks are disposable indexes.",
  },
];
