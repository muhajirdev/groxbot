import type { InitApp } from "@groxbot/adapter-kit";
import {
  type TemplateId,
  TemplateId as TemplateIdSchema,
  type WorkspaceApp,
} from "@groxbot/contracts";
import { type Database, messages, threads } from "@groxbot/db";
import { eq } from "drizzle-orm";
import type { GadgetFiles } from "./gadget-files.js";
import { newId } from "./ids.js";
import { appendThreadMessage, getHomeThread, iso } from "./threads.js";

function titledSlide(slide: Record<string, unknown>, title: string) {
  const next: Record<string, unknown> = { ...slide, title };
  if (!Array.isArray(slide.blocks)) return next;
  next.blocks = slide.blocks.map((block) => {
    if (!block || typeof block !== "object") return block;
    const item = block as Record<string, unknown>;
    if (item.type !== "title") return block;
    const props =
      item.props && typeof item.props === "object"
        ? (item.props as Record<string, unknown>)
        : {};
    return { ...item, props: { ...props, text: title } };
  });
  return next;
}

/** Seed the Gadget facet with the title from the chat card. */
export function applyAppTitle(
  templateId: TemplateId,
  state: unknown,
  title: string,
): unknown {
  if (!state || typeof state !== "object") {
    if (templateId === "docs") return { title, html: "<p></p>" };
    if (templateId === "slides") {
      return { slides: [{ id: "s1", title, body: "" }] };
    }
    if (templateId === "crm") return { title, contacts: [], revision: 1 };
    if (templateId === "game") {
      return {
        title,
        board: [null, null, null, null, null, null, null, null, null],
        turn: "X",
        winner: null,
      };
    }
    if (templateId === "app") return { title };
    return state;
  }
  if (templateId === "docs") return { ...state, title };
  if (templateId === "app") return { ...state, title };
  if (templateId === "slides" && "slides" in state) {
    const slides = Array.isArray(state.slides)
      ? state.slides.map((slide, index) => {
          if (index !== 0 || !slide || typeof slide !== "object") return slide;
          return titledSlide(slide as Record<string, unknown>, title);
        })
      : [{ id: "s1", title, body: "" }];
    return { ...state, slides };
  }
  if (templateId === "crm" || templateId === "game") {
    return { ...state, title };
  }
  return state;
}

/** Create the App Durable Object. Identity lives on the DO + chat card, not D1. */
export async function stampApp(opts: {
  initApp: InitApp;
  workspaceId: string;
  templateId: TemplateId;
  title: string;
  files?: GadgetFiles;
}): Promise<{ id: string; templateId: TemplateId; title: string }> {
  const title = opts.title.trim() || "Untitled";
  const id = newId();
  await opts.initApp(id, opts.templateId, {
    workspaceId: opts.workspaceId,
    title,
    ...(opts.files ? { files: opts.files } : {}),
  });
  return { id, templateId: opts.templateId, title };
}

/** D1 chat card so `apps.list` can see office-stamped gadgets. */
export async function recordAppChatCard(
  db: Database,
  opts: {
    workspaceId: string;
    botId: string;
    homeThreadId?: string | null;
    app: { id: string; templateId: TemplateId; title: string };
  },
): Promise<void> {
  const botId = opts.botId.trim();
  if (!botId) return;
  const thread = await getHomeThread(db, {
    id: botId,
    homeThreadId: opts.homeThreadId,
  });
  if (!thread) return;
  await appendThreadMessage(db, {
    workspaceId: opts.workspaceId,
    threadId: thread.id,
    botId,
    actorType: "bot",
    actorId: botId,
    blocks: [
      {
        kind: "app",
        appId: opts.app.id,
        templateId: opts.app.templateId,
        title: opts.app.title,
      },
    ],
  });
}

function asIso(value: Date | string): string {
  return typeof value === "string"
    ? value
    : (iso(value) ?? new Date().toISOString());
}

/** Dedupe chat-card apps: earliest createdAt, latest title. */
export function appsFromMessageBlocks(
  rows: Array<{ blocks: unknown; createdAt: Date | string }>,
): WorkspaceApp[] {
  const byId = new Map<string, WorkspaceApp>();
  for (const row of rows) {
    if (!Array.isArray(row.blocks)) continue;
    const createdAt = asIso(row.createdAt);
    for (const block of row.blocks) {
      if (!block || typeof block !== "object") continue;
      const item = block as Record<string, unknown>;
      if (item.kind !== "app") continue;
      const id = typeof item.appId === "string" ? item.appId.trim() : "";
      const parsed = TemplateIdSchema.safeParse(item.templateId);
      if (!id || !parsed.success) continue;
      const title =
        typeof item.title === "string" && item.title.trim()
          ? item.title.trim()
          : "Untitled";
      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, { id, templateId: parsed.data, title, createdAt });
        continue;
      }
      if (createdAt < existing.createdAt) {
        byId.set(id, { ...existing, createdAt });
      } else {
        byId.set(id, { ...existing, title, templateId: parsed.data });
      }
    }
  }
  return [...byId.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

/** Workspace sidebar list. Derived from chat cards, not a document catalog. */
export async function listWorkspaceApps(
  db: Database,
  workspaceId: string,
): Promise<WorkspaceApp[]> {
  const rows = await db
    .select({
      blocks: messages.blocks,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(threads, eq(messages.threadId, threads.id))
    .where(eq(threads.workspaceId, workspaceId));
  return appsFromMessageBlocks(rows);
}
