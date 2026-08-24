import type { TemplateId } from "@groxbot/contracts";

const VERB = /\b(make|create|draft|start|build|open|whip up|put together)\b/i;

const TEMPLATES: Array<{ re: RegExp; id: TemplateId; fallback: string }> = [
  {
    re: /\b(slides?|decks?|presentation)\b/i,
    id: "slides",
    fallback: "Untitled slides",
  },
  {
    re: /\b(spreadsheets?|workbooks?|sheets?)\b/i,
    id: "sheets",
    fallback: "Untitled sheet",
  },
  {
    re: /\b(docs?|documents?|writeup|memo)\b/i,
    id: "docs",
    fallback: "Untitled doc",
  },
];

export type AppIntent = {
  templateId: TemplateId;
  title: string;
};

/** Detect “make me slides about Q3” style asks. Ordinary chat returns null. */
export function parseAppIntent(prompt: string): AppIntent | null {
  const text = prompt.trim();
  if (!text || !VERB.test(text)) return null;
  const match = TEMPLATES.find((item) => item.re.test(text));
  if (!match) return null;
  const titled = text.match(
    /\b(?:about|on|for|of|called|named|titled)\s+(.+)$/i,
  );
  let title = (titled?.[1] ?? "")
    .trim()
    .replace(/[.?!]+$/g, "")
    .trim();
  title = title.replace(/\s+/g, " ");
  if (!title) title = match.fallback;
  if (title.length > 80) title = title.slice(0, 80).trim();
  return { templateId: match.id, title };
}
