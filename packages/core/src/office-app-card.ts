/**
 * Live-app chat card. Browser-safe. The model calls `stamp_app`; the actor
 * creates the Durable Object.
 */

import {
  type TemplateId,
  TemplateId as TemplateIdSchema,
} from "@groxbot/contracts";

export const OFFICE_STAMP_APP_TOOL_NAME = "stamp_app";

export const OFFICE_STAMP_APP_DESCRIPTION =
  "Create a live workspace app. A card appears in this thread when this returns ok. Any kind: pass title, clientJs, and serverJs. server.js must `import { DurableObject } from \"cloudflare:workers\"` and `export class Gadget extends DurableObject`. The iframe runs client.js; `gadget` is Cap'n Web RPC to that class; `RpcTarget` is available for callbacks (typically `gadget.subscribe`). No fetch or outbound network. Built-in shortcuts with no files: templateId docs, slides, sheets, crm, or game. Never claim an app exists until this returns.";

export const OFFICE_STAMP_APP_TITLES: Record<TemplateId, string> = {
  docs: "Untitled doc",
  slides: "Untitled slides",
  sheets: "Untitled sheet",
  crm: "Untitled CRM",
  game: "Tic-tac-toe",
  app: "Untitled app",
};

export function officeStampAppTitle(
  templateId: TemplateId,
  title?: string,
): string {
  const next = title?.trim() ?? "";
  return next || OFFICE_STAMP_APP_TITLES[templateId];
}

export type OfficeAppCard = {
  appId: string;
  templateId: TemplateId;
  title: string;
};

const KIND_LABEL: Record<TemplateId, string> = {
  docs: "Doc",
  slides: "Slides",
  sheets: "Sheet",
  crm: "CRM",
  game: "Game",
  app: "App",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseOfficeAppCard(value: unknown): OfficeAppCard | null {
  const row = asRecord(value);
  if (!row) return null;
  const nested = asRecord(row.app) ?? row;
  const appId =
    typeof nested.appId === "string"
      ? nested.appId.trim()
      : typeof nested.id === "string"
        ? nested.id.trim()
        : "";
  const parsed = TemplateIdSchema.safeParse(nested.templateId);
  if (!appId || !parsed.success) return null;
  const title =
    typeof nested.title === "string" && nested.title.trim()
      ? nested.title.trim()
      : "Untitled";
  return { appId, templateId: parsed.data, title };
}

export function officeAppCardFromMetadata(
  metadata: unknown,
): OfficeAppCard | null {
  const row = asRecord(metadata);
  if (!row) return null;
  const custom = asRecord(row.custom);
  return (
    parseOfficeAppCard(row.app) ??
    parseOfficeAppCard(custom?.app) ??
    parseOfficeAppCard(row) ??
    parseOfficeAppCard(custom)
  );
}

export function withOfficeAppCard(
  metadata: unknown,
  card: OfficeAppCard,
): Record<string, unknown> {
  const prev = asRecord(metadata) ?? {};
  const custom = asRecord(prev.custom) ?? {};
  const app = {
    appId: card.appId,
    templateId: card.templateId,
    title: card.title,
  };
  return { ...prev, app, custom: { ...custom, app } };
}

export function officeAppCardLine(card: OfficeAppCard): string {
  return `${KIND_LABEL[card.templateId]} · ${card.title}`;
}
