import type { AppStore } from "@groxbot/adapter-kit";
import type { TemplateId, WorkspaceApp } from "@groxbot/contracts";
import { TemplateId as TemplateIdSchema } from "@groxbot/contracts";
import { apps, bots, type Database } from "@groxbot/db";
import { and, desc, eq } from "drizzle-orm";
import { newId } from "./ids.js";
import { iso } from "./threads.js";

export class AppError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "BAD_REQUEST" = "NOT_FOUND",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toAppDto(row: typeof apps.$inferSelect): WorkspaceApp {
  const template = TemplateIdSchema.safeParse(row.templateId);
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    templateId: template.success ? template.data : "docs",
    title: row.title,
    createdByBotId: row.createdByBotId,
    createdFromThreadId: row.createdFromThreadId,
    codeVersion: row.codeVersion,
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(row.updatedAt) ?? new Date().toISOString(),
  };
}

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
    return state;
  }
  if (templateId === "docs") return { ...state, title };
  if (templateId === "slides" && "slides" in state) {
    const slides = Array.isArray(state.slides)
      ? state.slides.map((slide, index) => {
          if (index !== 0 || !slide || typeof slide !== "object") return slide;
          return titledSlide(slide as Record<string, unknown>, title);
        })
      : [{ id: "s1", title, body: "" }];
    return { ...state, slides };
  }
  return state;
}

export async function listWorkspaceApps(
  db: Database,
  workspaceId: string,
): Promise<WorkspaceApp[]> {
  const rows = await db
    .select()
    .from(apps)
    .where(eq(apps.workspaceId, workspaceId))
    .orderBy(desc(apps.updatedAt));
  return rows.map(toAppDto);
}

export async function getWorkspaceApp(
  db: Database,
  workspaceId: string,
  appId: string,
): Promise<WorkspaceApp> {
  const [row] = await db
    .select()
    .from(apps)
    .where(and(eq(apps.id, appId), eq(apps.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new AppError("App missing");
  return toAppDto(row);
}

export async function createWorkspaceApp(opts: {
  db: Database;
  store: AppStore;
  workspaceId: string;
  templateId: TemplateId;
  title: string;
  createdByBotId?: string | null;
  createdFromThreadId?: string | null;
}): Promise<WorkspaceApp> {
  const title = opts.title.trim() || "Untitled";
  if (opts.createdByBotId) {
    const [bot] = await opts.db
      .select({ id: bots.id })
      .from(bots)
      .where(
        and(
          eq(bots.id, opts.createdByBotId),
          eq(bots.workspaceId, opts.workspaceId),
        ),
      )
      .limit(1);
    if (!bot) throw new AppError("Bot missing");
  }
  const id = newId();
  const [row] = await opts.db
    .insert(apps)
    .values({
      id,
      workspaceId: opts.workspaceId,
      templateId: opts.templateId,
      title,
      createdByBotId: opts.createdByBotId ?? null,
      createdFromThreadId: opts.createdFromThreadId ?? null,
    })
    .returning();
  if (!row) throw new AppError("Could not create app", "BAD_REQUEST");
  await opts.store.init(id, opts.templateId);
  const loaded = await opts.store.call(id, "load", []);
  await opts.store.call(id, "save", [
    applyAppTitle(opts.templateId, loaded, title),
  ]);
  return toAppDto(row);
}
