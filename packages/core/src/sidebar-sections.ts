import type { SidebarSection } from "@groxbot/contracts";
import { bots, type Database, sidebarSections } from "@groxbot/db";
import { and, asc, eq, max } from "drizzle-orm";
import { newId } from "./ids.js";
import {
  nextSectionPosition,
  SectionError,
  sectionName,
} from "./sidebar-roster.js";

export {
  compareSidebarBots,
  groupSidebarBots,
  isPinnedBot,
  mixSidebarLive,
  nextSectionPosition,
  roomSidebarFaces,
  SectionError,
  sectionName,
} from "./sidebar-roster.js";
export type { SidebarLiveItem, SidebarSectionBucket } from "./sidebar-roster.js";

export function toSectionDto(
  row: typeof sidebarSections.$inferSelect,
): SidebarSection {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSections(
  db: Database,
  workspaceId: string,
): Promise<SidebarSection[]> {
  const rows = await db
    .select()
    .from(sidebarSections)
    .where(eq(sidebarSections.workspaceId, workspaceId))
    .orderBy(asc(sidebarSections.position), asc(sidebarSections.id));
  return rows.map(toSectionDto);
}

export async function createSection(
  db: Database,
  input: { workspaceId: string; name: string; id?: string },
): Promise<SidebarSection> {
  const name = sectionName(input.name);
  const [agg] = await db
    .select({ top: max(sidebarSections.position) })
    .from(sidebarSections)
    .where(eq(sidebarSections.workspaceId, input.workspaceId));
  const position = nextSectionPosition(
    agg?.top === null || agg?.top === undefined ? [] : [agg.top],
  );
  const id = input.id?.trim() || newId();
  const [row] = await db
    .insert(sidebarSections)
    .values({
      id,
      workspaceId: input.workspaceId,
      name,
      position,
    })
    .returning();
  if (!row) throw new SectionError("Could not create that section.");
  return toSectionDto(row);
}

export async function renameSection(
  db: Database,
  input: { workspaceId: string; sectionId: string; name: string },
): Promise<SidebarSection> {
  const name = sectionName(input.name);
  const now = new Date();
  const [row] = await db
    .update(sidebarSections)
    .set({ name, updatedAt: now })
    .where(
      and(
        eq(sidebarSections.id, input.sectionId),
        eq(sidebarSections.workspaceId, input.workspaceId),
      ),
    )
    .returning();
  if (!row) throw new SectionError("That section is missing.");
  return toSectionDto(row);
}

export async function removeSection(
  db: Database,
  input: { workspaceId: string; sectionId: string },
): Promise<{ ok: true }> {
  const deleted = await db
    .delete(sidebarSections)
    .where(
      and(
        eq(sidebarSections.id, input.sectionId),
        eq(sidebarSections.workspaceId, input.workspaceId),
      ),
    )
    .returning();
  if (deleted.length === 0) throw new SectionError("That section is missing.");
  return { ok: true };
}

export async function moveBotToSection(
  db: Database,
  input: { workspaceId: string; botId: string; sectionId: string | null },
): Promise<typeof bots.$inferSelect> {
  const [bot] = await db
    .select()
    .from(bots)
    .where(
      and(eq(bots.id, input.botId), eq(bots.workspaceId, input.workspaceId)),
    )
    .limit(1);
  if (!bot) throw new SectionError("Bot not found.");
  if (input.sectionId) {
    const [section] = await db
      .select({ id: sidebarSections.id })
      .from(sidebarSections)
      .where(
        and(
          eq(sidebarSections.id, input.sectionId),
          eq(sidebarSections.workspaceId, input.workspaceId),
        ),
      )
      .limit(1);
    if (!section) throw new SectionError("That section is missing.");
  }
  if ((bot.sectionId ?? null) === input.sectionId) return bot;
  const now = new Date();
  const [updated] = await db
    .update(bots)
    .set({ sectionId: input.sectionId, updatedAt: now })
    .where(eq(bots.id, bot.id))
    .returning();
  if (!updated) throw new SectionError("Bot not found.");
  return updated;
}
