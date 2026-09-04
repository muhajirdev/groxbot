import type { TemplateId } from "@groxbot/contracts";
import type { OfficeMessage, OfficePart } from "./office-messages";

export type OfficeAppCard = {
  appId: string;
  templateId: TemplateId;
  title: string;
};

const TEMPLATES = new Set<string>(["docs", "slides", "sheets"]);

function asCard(value: unknown): OfficeAppCard | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const nested =
    row.app && typeof row.app === "object"
      ? (row.app as Record<string, unknown>)
      : row;
  const appId = String(nested.appId ?? nested.id ?? "").trim();
  const templateId = String(nested.templateId ?? "").trim();
  const title = String(nested.title ?? "").trim() || "Untitled";
  if (!appId || !TEMPLATES.has(templateId)) return null;
  return { appId, templateId: templateId as TemplateId, title };
}

function cardsFromPart(part: OfficePart): OfficeAppCard[] {
  if (part.type === "app" || part.type === "data-app") {
    const card = asCard(part);
    return card ? [card] : [];
  }
  const fromOutput = asCard(part.output) ?? asCard(part.result) ?? asCard(part);
  return fromOutput ? [fromOutput] : [];
}

export function appCardsFromOfficeMessage(
  message: OfficeMessage,
): OfficeAppCard[] {
  const seen = new Set<string>();
  const cards: OfficeAppCard[] = [];
  for (const part of message.parts) {
    for (const card of cardsFromPart(part)) {
      if (seen.has(card.appId)) continue;
      seen.add(card.appId);
      cards.push(card);
    }
  }
  return cards;
}
