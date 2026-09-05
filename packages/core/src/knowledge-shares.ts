import type {
  KnowledgeShare,
  KnowledgeShareKind,
  PublicKnowledge,
  PublicKnowledgeEntry,
} from "@groxbot/contracts";
import { knowledgeShares, type Database } from "@groxbot/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { newId } from "./ids.js";
import {
  isKnowledgeHiddenPath,
  KnowledgeFileError,
  KnowledgePathError,
  downloadKnowledge,
  listKnowledge,
  readKnowledge,
  sanitizeKnowledgePath,
  type KnowledgeDisk,
} from "./knowledge.js";

export class KnowledgeShareError extends Error {
  constructor(message = "Could not share that note.") {
    super(message);
    this.name = "KnowledgeShareError";
  }
}

export function knowledgeShareCoversPath(
  granted: string,
  kind: KnowledgeShareKind,
  requested: string,
): boolean {
  if (kind === "file") return requested === granted;
  return requested === granted || requested.startsWith(`${granted}/`);
}

export function assertShareableKnowledgePath(raw: string): string {
  const path = sanitizeKnowledgePath(raw);
  if (!path) {
    throw new KnowledgeShareError(
      "Share a file or folder, not the whole office.",
    );
  }
  if (isKnowledgeHiddenPath(path)) {
    throw new KnowledgeShareError("That path is not shareable.");
  }
  return path;
}

export function toKnowledgeShareDto(
  row: typeof knowledgeShares.$inferSelect,
): KnowledgeShare {
  return {
    id: row.id,
    path: row.path,
    kind: row.kind === "folder" ? "folder" : "file",
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listKnowledgeShares(
  db: Database,
  workspaceId: string,
): Promise<KnowledgeShare[]> {
  const rows = await db
    .select()
    .from(knowledgeShares)
    .where(
      and(
        eq(knowledgeShares.workspaceId, workspaceId),
        isNull(knowledgeShares.revokedAt),
      ),
    );
  return rows.map(toKnowledgeShareDto);
}

export async function getActiveKnowledgeShare(
  db: Database,
  shareId: string,
): Promise<(typeof knowledgeShares.$inferSelect) | undefined> {
  const id = shareId.trim();
  if (!id) return undefined;
  const [row] = await db
    .select()
    .from(knowledgeShares)
    .where(and(eq(knowledgeShares.id, id), isNull(knowledgeShares.revokedAt)))
    .limit(1);
  return row;
}

export async function createKnowledgeShare(
  db: Database,
  disk: KnowledgeDisk | null,
  actor: { workspaceId: string; userId: string },
  input: { path: string; kind: KnowledgeShareKind },
): Promise<KnowledgeShare> {
  const path = assertShareableKnowledgePath(input.path);
  if (disk) {
    const listed = await listKnowledge(disk, actor.workspaceId);
    const exact = listed.entries.some((entry) => entry.path === path);
    const nested = listed.entries.some((entry) =>
      entry.path.startsWith(`${path}/`),
    );
    if (input.kind === "file") {
      if (!exact) throw new KnowledgeFileError("File not found.");
    } else if (exact && !nested) {
      throw new KnowledgeShareError("That's a file, not a folder.");
    }
  }

  const [live] = await db
    .select()
    .from(knowledgeShares)
    .where(
      and(
        eq(knowledgeShares.workspaceId, actor.workspaceId),
        eq(knowledgeShares.path, path),
        isNull(knowledgeShares.revokedAt),
      ),
    )
    .limit(1);
  if (live) return toKnowledgeShareDto(live);

  const [created] = await db
    .insert(knowledgeShares)
    .values({
      id: newId(),
      workspaceId: actor.workspaceId,
      path,
      kind: input.kind,
      createdByUserId: actor.userId,
    })
    .returning();
  if (!created) throw new KnowledgeShareError();
  return toKnowledgeShareDto(created);
}

export async function revokeKnowledgeShare(
  db: Database,
  workspaceId: string,
  shareId: string,
): Promise<void> {
  const id = shareId.trim();
  if (!id) throw new KnowledgeShareError("Missing share.");
  const updated = await db
    .update(knowledgeShares)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(knowledgeShares.id, id),
        eq(knowledgeShares.workspaceId, workspaceId),
        isNull(knowledgeShares.revokedAt),
      ),
    )
    .returning();
  if (updated.length === 0) throw new KnowledgeFileError("Share not found.");
}

export async function revokeKnowledgeSharesForPrefix(
  db: Database,
  workspaceId: string,
  rawPath: string,
): Promise<void> {
  const path = sanitizeKnowledgePath(rawPath);
  if (!path) return;
  const rows = await db
    .select({ id: knowledgeShares.id, path: knowledgeShares.path })
    .from(knowledgeShares)
    .where(
      and(
        eq(knowledgeShares.workspaceId, workspaceId),
        isNull(knowledgeShares.revokedAt),
      ),
    );
  const ids = rows
    .filter((row) => row.path === path || row.path.startsWith(`${path}/`))
    .map((row) => row.id);
  if (ids.length === 0) return;
  await db
    .update(knowledgeShares)
    .set({ revokedAt: new Date() })
    .where(inArray(knowledgeShares.id, ids));
}

function publicFolderEntries(
  files: { path: string; name: string; title: string; mediaType: string }[],
  folder: string,
): PublicKnowledgeEntry[] {
  const prefix = `${folder}/`;
  const dirs = new Set<string>();
  const entries: PublicKnowledgeEntry[] = [];
  for (const file of files) {
    if (!file.path.startsWith(prefix)) continue;
    const rest = file.path.slice(prefix.length);
    const [head, ...tail] = rest.split("/").filter(Boolean);
    if (!head) continue;
    if (tail.length === 0) {
      entries.push({
        path: file.path,
        name: file.name,
        title: file.title || file.name,
        kind: "file",
        mediaType: file.mediaType,
      });
      continue;
    }
    const dirPath = `${folder}/${head}`;
    if (dirs.has(dirPath)) continue;
    dirs.add(dirPath);
    entries.push({
      path: dirPath,
      name: head,
      title: head,
      kind: "dir",
    });
  }
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

export async function readPublicKnowledge(
  db: Database,
  disk: KnowledgeDisk,
  shareId: string,
  childPath?: string,
): Promise<PublicKnowledge> {
  const row = await getActiveKnowledgeShare(db, shareId);
  if (!row) throw new KnowledgeFileError("Share not found.");
  const granted = row.path;
  const kind: KnowledgeShareKind = row.kind === "folder" ? "folder" : "file";
  const requested = sanitizeKnowledgePath(childPath || granted);
  if (!requested || !knowledgeShareCoversPath(granted, kind, requested)) {
    throw new KnowledgePathError();
  }
  if (isKnowledgeHiddenPath(requested)) throw new KnowledgePathError();

  if (kind === "folder") {
    const listed = await listKnowledge(disk, row.workspaceId);
    const exactFile = listed.entries.some((entry) => entry.path === requested);
    const nested = listed.entries.some((entry) =>
      entry.path.startsWith(`${requested}/`),
    );
    if (!exactFile && (requested === granted || nested)) {
      return {
        kind: "folder",
        shareId: row.id,
        path: requested,
        root: granted,
        title: requested.split("/").at(-1) || requested,
        entries: publicFolderEntries(listed.entries, requested),
      };
    }
    if (!exactFile) throw new KnowledgeFileError("File not found.");
  }

  const file = await readKnowledge(disk, row.workspaceId, requested);
  return {
    kind: "file",
    shareId: row.id,
    path: file.path,
    root: granted,
    title: file.title,
    description: file.description,
    content: file.encoding === "text" ? file.content : undefined,
    truncated: file.truncated,
    encoding: file.encoding,
    mediaType: file.mediaType,
  };
}

export async function downloadPublicKnowledge(
  db: Database,
  disk: KnowledgeDisk,
  shareId: string,
  childPath: string | undefined,
) {
  const row = await getActiveKnowledgeShare(db, shareId);
  if (!row) throw new KnowledgeFileError("Share not found.");
  const granted = row.path;
  const kind: KnowledgeShareKind = row.kind === "folder" ? "folder" : "file";
  const requested = sanitizeKnowledgePath(childPath || granted);
  if (!requested || !knowledgeShareCoversPath(granted, kind, requested)) {
    throw new KnowledgePathError();
  }
  if (isKnowledgeHiddenPath(requested)) throw new KnowledgePathError();
  if (kind === "folder" && requested === granted) {
    throw new KnowledgePathError("Pick a file in this folder.");
  }
  return downloadKnowledge(disk, row.workspaceId, requested);
}
