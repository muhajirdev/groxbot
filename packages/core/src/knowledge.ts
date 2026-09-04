/** Workspace knowledge on R2. One prefix per office — not this bot’s computer. */

import {
  type ComputerDownload,
  type KnowledgeEntry,
  type KnowledgeFile,
  type KnowledgeGraph,
  type KnowledgeList,
  type KnowledgeWrite,
  MAX_COMPUTER_WRITE_BYTES,
} from "@groxbot/contracts";
import { encodeComputerBytes } from "./computer.js";
import {
  dropKnowledgeLinkPrefix,
  dropKnowledgeLinkSource,
  emptyKnowledgeLinkSnapshot,
  encodeKnowledgeLinkSnapshot,
  extractOfficeMarkdownPaths,
  indexesMarkdownForLinks,
  isKnowledgeLinksPath,
  KNOWLEDGE_LINKS_PATH,
  type KnowledgeLinkSnapshot,
  knowledgeBacklinks,
  parseKnowledgeLinkSnapshot,
  setKnowledgeLinkSource,
} from "./knowledge-links.js";
import {
  dropKnowledgeSearchDoc,
  dropKnowledgeSearchPrefix,
  emptyKnowledgeSearchSnapshot,
  encodeKnowledgeSearchSnapshot,
  isKnowledgeSearchPath,
  isKnowledgeSearchSegmentPath,
  KNOWLEDGE_SEARCH_LEGACY_MANIFEST,
  KNOWLEDGE_SEARCH_PATH,
  type KnowledgeSearchHit,
  type KnowledgeSearchSnapshot,
  knowledgeSearchDoc,
  MAX_KNOWLEDGE_READ_MANY,
  MAX_KNOWLEDGE_SEARCH_HITS,
  parseKnowledgeSearchDocs,
  parseKnowledgeSearchManifest,
  parseKnowledgeSearchSnapshot,
  rankKnowledgeSearch,
  setKnowledgeSearchDoc,
} from "./knowledge-search.js";
import {
  isSkillName,
  MAX_SKILL_BYTES,
  MAX_SKILL_RESOURCES,
  MAX_WORKSPACE_SKILLS,
  parseSkillMarkdown,
  SKILL_FILE,
  type SkillContent,
  type SkillDescriptor,
  type SkillResourceDescriptor,
  type SkillWorkspace,
  skillResourceKind,
  skillResourcePathError,
  type WorkspaceSkillSource,
  workspaceSkillSource,
} from "./skills.js";

export const MAX_KNOWLEDGE_ENTRIES = 800;
export const MAX_KNOWLEDGE_READ_CHARS = 64_000;
export const MAX_KNOWLEDGE_NOTE_CHARS = 64_000;
export const MAX_KNOWLEDGE_PATH = 240;

const TEXT_EXTENSIONS = new Set([
  ".bash",
  ".css",
  ".csv",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".py",
  ".sh",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

export class KnowledgePathError extends Error {
  constructor(message = "That path is not in this office.") {
    super(message);
    this.name = "KnowledgePathError";
  }
}

export class KnowledgeFileError extends Error {
  constructor(message = "File not found.") {
    super(message);
    this.name = "KnowledgeFileError";
  }
}

export class KnowledgeWriteError extends Error {
  constructor(message = "Could not save that to the office.") {
    super(message);
    this.name = "KnowledgeWriteError";
  }
}

export type KnowledgeObject = {
  key: string;
  size?: number;
  uploaded?: Date;
};

export type KnowledgeDisk = {
  list(prefix: string): Promise<KnowledgeObject[]>;
  getText(key: string): Promise<string | null>;
  getBytes(key: string): Promise<Uint8Array | null>;
  put(
    key: string,
    content: string | Uint8Array,
    contentType?: string,
  ): Promise<void>;
  delete(key: string): Promise<void>;
};

export type KnowledgeTreeNode = {
  path: string;
  name: string;
  kind: "dir" | "file";
  title: string;
  description: string;
  encoding?: "text" | "binary";
  children: KnowledgeTreeNode[];
};

export function knowledgeObjectKey(workspaceId: string, path: string): string {
  const office = sanitizeWorkspaceId(workspaceId);
  const relative = sanitizeKnowledgePath(path);
  if (!relative) throw new KnowledgePathError();
  return `${office}/${relative}`;
}

export function sanitizeWorkspaceId(raw: string): string {
  const id = raw.trim();
  if (
    !id ||
    id.length > 80 ||
    id.includes("/") ||
    id.includes("\\") ||
    id.includes("\0") ||
    id.includes("..")
  ) {
    throw new KnowledgePathError("Unknown office.");
  }
  return id;
}

export function sanitizeKnowledgePath(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "/" || trimmed === ".") return "";
  const normalized = trimmed.replaceAll("\\", "/").replace(/^\/+/u, "");
  const parts: string[] = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part === ".." || part.includes("\0")) throw new KnowledgePathError();
    parts.push(part);
  }
  const path = parts.join("/");
  if (path.length > MAX_KNOWLEDGE_PATH) throw new KnowledgePathError();
  return path;
}

function isKnowledgeHiddenPath(path: string): boolean {
  return isKnowledgeLinksPath(path) || isKnowledgeSearchPath(path);
}

export function isKnowledgeSkillFile(path: string): boolean {
  return path === SKILL_FILE || path.endsWith(`/${SKILL_FILE}`);
}

export function knowledgeSkillName(path: string): string | null {
  if (!isKnowledgeSkillFile(path)) return null;
  const folder =
    path === SKILL_FILE ? "" : path.slice(0, -`/${SKILL_FILE}`.length);
  const leaf = folder.split("/").filter(Boolean).at(-1) ?? "";
  return isSkillName(leaf) ? leaf : null;
}

export function formatSkillMarkdown(input: {
  name: string;
  description: string;
  body: string;
}): string {
  return `---\nname: ${input.name}\ndescription: ${input.description}\n---\n${input.body.replace(/^\n+/u, "")}`;
}

export async function listKnowledge(
  disk: KnowledgeDisk,
  workspaceId: string,
): Promise<KnowledgeList> {
  const office = sanitizeWorkspaceId(workspaceId);
  const prefix = `${office}/`;
  const objects = await disk.list(prefix);
  const entries: KnowledgeEntry[] = [];
  let truncated = objects.length >= MAX_KNOWLEDGE_ENTRIES;
  for (const object of objects) {
    if (entries.length >= MAX_KNOWLEDGE_ENTRIES) {
      truncated = true;
      break;
    }
    if (!object.key.startsWith(prefix)) continue;
    const path = object.key.slice(prefix.length);
    if (!path || path.endsWith("/") || isKnowledgeHiddenPath(path)) continue;
    const entry = await entryFromObject(disk, office, path, object);
    if (entry) entries.push(entry);
  }
  return {
    entries: entries.sort((a, b) => a.path.localeCompare(b.path)),
    truncated,
  };
}

export async function readKnowledge(
  disk: KnowledgeDisk,
  workspaceId: string,
  rawPath: string,
): Promise<KnowledgeFile> {
  const path = sanitizeKnowledgePath(rawPath);
  if (!path) throw new KnowledgePathError("Pick a file in the office.");
  if (isKnowledgeHiddenPath(path)) throw new KnowledgeFileError();
  const bytes = await disk.getBytes(knowledgeObjectKey(workspaceId, path));
  if (!bytes) throw new KnowledgeFileError();
  const snapshot = await loadKnowledgeLinkSnapshot(disk, workspaceId);
  return knowledgeFileFromBytes(disk, workspaceId, path, bytes, snapshot);
}

export async function readKnowledgeMany(
  disk: KnowledgeDisk,
  workspaceId: string,
  rawPaths: string[],
): Promise<{ files: KnowledgeFile[]; missing: string[]; truncated: boolean }> {
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const raw of rawPaths) {
    let path = "";
    try {
      path = sanitizeKnowledgePath(raw);
    } catch {
      continue;
    }
    if (!path || isKnowledgeHiddenPath(path) || seen.has(path)) continue;
    seen.add(path);
    paths.push(path);
  }
  const truncated = paths.length > MAX_KNOWLEDGE_READ_MANY;
  const picked = paths.slice(0, MAX_KNOWLEDGE_READ_MANY);
  const snapshot = await loadKnowledgeLinkSnapshot(disk, workspaceId);
  const files: KnowledgeFile[] = [];
  const missing: string[] = [];
  for (const path of picked) {
    const bytes = await disk.getBytes(knowledgeObjectKey(workspaceId, path));
    if (!bytes) {
      missing.push(path);
      continue;
    }
    files.push(
      await knowledgeFileFromBytes(disk, workspaceId, path, bytes, snapshot),
    );
  }
  return { files, missing, truncated };
}

async function knowledgeFileFromBytes(
  disk: KnowledgeDisk,
  workspaceId: string,
  path: string,
  bytes: Uint8Array,
  snapshot: KnowledgeLinkSnapshot,
): Promise<KnowledgeFile> {
  const name = path.split("/").at(-1) ?? path;
  const mediaType = mediaTypeForKnowledgePath(path);
  const meta = await fileMeta(disk, sanitizeWorkspaceId(workspaceId), path);
  const backlinks = knowledgeBacklinks(snapshot, path);
  if (!isTextBytes(path, bytes)) {
    return {
      path,
      title: meta.title,
      description: meta.description,
      content: "",
      truncated: false,
      encoding: "binary",
      mediaType,
      backlinks,
    };
  }
  const text = new TextDecoder().decode(bytes);
  const truncated = text.length > MAX_KNOWLEDGE_READ_CHARS;
  return {
    path,
    title: meta.title || name,
    description: meta.description,
    content: truncated ? text.slice(0, MAX_KNOWLEDGE_READ_CHARS) : text,
    truncated,
    encoding: "text",
    mediaType,
    backlinks,
  };
}

export async function downloadKnowledge(
  disk: KnowledgeDisk,
  workspaceId: string,
  rawPath: string,
): Promise<ComputerDownload> {
  const path = sanitizeKnowledgePath(rawPath);
  if (!path) throw new KnowledgePathError("Pick a file in the office.");
  if (isKnowledgeHiddenPath(path)) throw new KnowledgeFileError();
  const bytes = await disk.getBytes(knowledgeObjectKey(workspaceId, path));
  if (!bytes) throw new KnowledgeFileError();
  if (bytes.byteLength > MAX_COMPUTER_WRITE_BYTES) {
    throw new KnowledgeWriteError("That file is too large to download.");
  }
  return {
    path,
    filename: path.split("/").at(-1) ?? path,
    content: encodeComputerBytes(bytes),
    mediaType: mediaTypeForKnowledgePath(path),
  };
}

export async function writeKnowledge(
  disk: KnowledgeDisk,
  workspaceId: string,
  input: KnowledgeWrite,
): Promise<{ path: string }> {
  const path = sanitizeKnowledgePath(input.path);
  if (!path) throw new KnowledgePathError("Name the file.");
  if (isKnowledgeHiddenPath(path)) {
    throw new KnowledgePathError("That path is reserved.");
  }
  const mediaType = input.mediaType || mediaTypeForKnowledgePath(path);
  if (input.encoding === "base64") {
    const bytes = decodeKnowledgeBytes(input.content);
    if (bytes.byteLength > MAX_COMPUTER_WRITE_BYTES) {
      throw new KnowledgeWriteError("That file is too large for the office.");
    }
    await disk.put(knowledgeObjectKey(workspaceId, path), bytes, mediaType);
    const text = indexesMarkdownForLinks(path)
      ? new TextDecoder().decode(bytes)
      : null;
    await syncKnowledgeLinks(disk, workspaceId, path, text);
    await syncKnowledgeSearch(
      disk,
      workspaceId,
      path,
      isTextBytes(path, bytes) ? new TextDecoder().decode(bytes) : null,
    );
    return { path };
  }
  if (input.content.length > MAX_KNOWLEDGE_NOTE_CHARS) {
    throw new KnowledgeWriteError("That file is too long.");
  }
  await disk.put(
    knowledgeObjectKey(workspaceId, path),
    input.content,
    mediaType,
  );
  await syncKnowledgeLinks(
    disk,
    workspaceId,
    path,
    indexesMarkdownForLinks(path) ? input.content : null,
  );
  await syncKnowledgeSearch(disk, workspaceId, path, input.content);
  return { path };
}

export async function removeKnowledge(
  disk: KnowledgeDisk,
  workspaceId: string,
  rawPath: string,
): Promise<void> {
  const path = sanitizeKnowledgePath(rawPath);
  if (!path) throw new KnowledgePathError();
  const office = sanitizeWorkspaceId(workspaceId);
  const fileKey = `${office}/${path}`;
  if ((await disk.getBytes(fileKey)) != null) {
    await disk.delete(fileKey);
    await syncKnowledgeLinksRemoved(disk, workspaceId, path);
    await syncKnowledgeSearchRemoved(disk, workspaceId, path);
    return;
  }
  const prefix = `${fileKey}/`;
  const objects = await disk.list(prefix);
  const keys = objects
    .map((object) => object.key)
    .filter((key) => key.startsWith(prefix));
  if (keys.length === 0) throw new KnowledgeFileError();
  for (const key of keys) await disk.delete(key);
  await syncKnowledgeLinksRemoved(disk, workspaceId, path);
  await syncKnowledgeSearchRemoved(disk, workspaceId, path);
}

export async function listKnowledgeBacklinks(
  disk: KnowledgeDisk,
  workspaceId: string,
  rawPath: string,
): Promise<string[]> {
  const path = sanitizeKnowledgePath(rawPath);
  if (!path || isKnowledgeHiddenPath(path)) return [];
  const snapshot = await loadKnowledgeLinkSnapshot(disk, workspaceId);
  return knowledgeBacklinks(snapshot, path);
}

export async function listKnowledgeGraph(
  disk: KnowledgeDisk,
  workspaceId: string,
): Promise<KnowledgeGraph> {
  const snapshot = await loadKnowledgeLinkSnapshot(disk, workspaceId);
  return { paths: snapshot.paths, out: snapshot.out };
}

export async function searchKnowledge(
  disk: KnowledgeDisk,
  workspaceId: string,
  query: string,
  limit = MAX_KNOWLEDGE_SEARCH_HITS,
): Promise<{ hits: KnowledgeSearchHit[]; truncated: boolean }> {
  const snapshot = await loadKnowledgeSearchSnapshot(disk, workspaceId);
  const ready =
    snapshot.docs.length > 0
      ? snapshot
      : await rebuildKnowledgeSearch(disk, workspaceId);
  const cap = Math.max(1, Math.min(limit, MAX_KNOWLEDGE_SEARCH_HITS));
  const hits = rankKnowledgeSearch(ready.docs, query, cap);
  return { hits, truncated: ready.docs.length >= MAX_KNOWLEDGE_ENTRIES };
}

async function loadKnowledgeLinkSnapshot(
  disk: KnowledgeDisk,
  workspaceId: string,
): Promise<KnowledgeLinkSnapshot> {
  const office = sanitizeWorkspaceId(workspaceId);
  const raw = await disk.getText(`${office}/${KNOWLEDGE_LINKS_PATH}`);
  if (!raw) return emptyKnowledgeLinkSnapshot();
  return parseKnowledgeLinkSnapshot(raw) ?? emptyKnowledgeLinkSnapshot();
}

async function saveKnowledgeLinkSnapshot(
  disk: KnowledgeDisk,
  workspaceId: string,
  snapshot: KnowledgeLinkSnapshot,
): Promise<void> {
  const office = sanitizeWorkspaceId(workspaceId);
  const key = `${office}/${KNOWLEDGE_LINKS_PATH}`;
  if (snapshot.paths.length === 0) {
    await disk.delete(key);
    return;
  }
  await disk.put(
    key,
    encodeKnowledgeLinkSnapshot(snapshot),
    "application/json",
  );
}

async function loadKnowledgeSearchSnapshot(
  disk: KnowledgeDisk,
  workspaceId: string,
): Promise<KnowledgeSearchSnapshot> {
  const office = sanitizeWorkspaceId(workspaceId);
  const raw = await disk.getText(`${office}/${KNOWLEDGE_SEARCH_PATH}`);
  if (raw) {
    const parsed = parseKnowledgeSearchSnapshot(raw);
    if (parsed) return parsed;
  }
  return loadLegacyShardedSearch(disk, workspaceId, office);
}

async function loadLegacyShardedSearch(
  disk: KnowledgeDisk,
  workspaceId: string,
  office: string,
): Promise<KnowledgeSearchSnapshot> {
  const manifestRaw = await disk.getText(
    `${office}/${KNOWLEDGE_SEARCH_LEGACY_MANIFEST}`,
  );
  if (!manifestRaw) return emptyKnowledgeSearchSnapshot();
  const manifest = parseKnowledgeSearchManifest(manifestRaw);
  if (!manifest) return emptyKnowledgeSearchSnapshot();
  const shards = await Promise.all(
    manifest.segments.map((path) => disk.getText(`${office}/${path}`)),
  );
  const docs: KnowledgeSearchSnapshot["docs"] = [];
  for (const raw of shards) {
    if (!raw) continue;
    const part = parseKnowledgeSearchDocs(raw);
    if (part) docs.push(...part);
  }
  const snapshot: KnowledgeSearchSnapshot = {
    v: manifest.v,
    rev: manifest.rev,
    updatedAt: manifest.updatedAt,
    docs,
  };
  if (snapshot.docs.length === 0) return snapshot;
  try {
    await saveKnowledgeSearchSnapshot(disk, workspaceId, snapshot);
  } catch {
    // Disposable. Search can still use the in-memory docs.
  }
  return snapshot;
}

async function saveKnowledgeSearchSnapshot(
  disk: KnowledgeDisk,
  workspaceId: string,
  snapshot: KnowledgeSearchSnapshot,
): Promise<void> {
  const office = sanitizeWorkspaceId(workspaceId);
  const keep = new Set<string>();
  if (snapshot.docs.length === 0) {
    await deleteKnowledgeSearchObjects(disk, office, keep);
    return;
  }
  keep.add(KNOWLEDGE_SEARCH_PATH);
  await disk.put(
    `${office}/${KNOWLEDGE_SEARCH_PATH}`,
    encodeKnowledgeSearchSnapshot(snapshot),
    "application/json",
  );
  await deleteKnowledgeSearchObjects(disk, office, keep);
}

async function deleteKnowledgeSearchObjects(
  disk: KnowledgeDisk,
  office: string,
  keep: Set<string>,
): Promise<void> {
  const prefix = `${office}/`;
  const objects = await disk.list(`${office}/_search/`);
  for (const object of objects) {
    if (!object.key.startsWith(prefix)) continue;
    const path = object.key.slice(prefix.length);
    if (keep.has(path)) continue;
    if (
      path === KNOWLEDGE_SEARCH_PATH ||
      path === KNOWLEDGE_SEARCH_LEGACY_MANIFEST ||
      isKnowledgeSearchSegmentPath(path)
    ) {
      await disk.delete(object.key);
    }
  }
}

async function syncKnowledgeSearch(
  disk: KnowledgeDisk,
  workspaceId: string,
  path: string,
  content: string | null,
): Promise<void> {
  try {
    const current = await loadKnowledgeSearchSnapshot(disk, workspaceId);
    const next = setKnowledgeSearchDoc(
      current,
      knowledgeSearchDoc(path, content),
      MAX_KNOWLEDGE_ENTRIES,
    );
    if (next.rev === current.rev) return;
    await saveKnowledgeSearchSnapshot(disk, workspaceId, next);
  } catch {
    // Disposable cache. The note already landed.
  }
}

async function syncKnowledgeSearchRemoved(
  disk: KnowledgeDisk,
  workspaceId: string,
  path: string,
): Promise<void> {
  try {
    const current = await loadKnowledgeSearchSnapshot(disk, workspaceId);
    const dropped = dropKnowledgeSearchDoc(current, path);
    const next =
      dropped.rev === current.rev
        ? dropKnowledgeSearchPrefix(current, path)
        : dropped;
    if (next.rev === current.rev) return;
    await saveKnowledgeSearchSnapshot(disk, workspaceId, next);
  } catch {
    // Disposable cache.
  }
}

async function rebuildKnowledgeSearch(
  disk: KnowledgeDisk,
  workspaceId: string,
): Promise<KnowledgeSearchSnapshot> {
  const listed = await listKnowledge(disk, workspaceId);
  let snapshot = emptyKnowledgeSearchSnapshot();
  for (const entry of listed.entries) {
    if (entry.encoding !== "text") {
      snapshot = setKnowledgeSearchDoc(
        snapshot,
        knowledgeSearchDoc(entry.path, null),
        MAX_KNOWLEDGE_ENTRIES,
      );
      continue;
    }
    const raw = await disk.getText(knowledgeObjectKey(workspaceId, entry.path));
    snapshot = setKnowledgeSearchDoc(
      snapshot,
      knowledgeSearchDoc(entry.path, raw),
      MAX_KNOWLEDGE_ENTRIES,
    );
  }
  await saveKnowledgeSearchSnapshot(disk, workspaceId, snapshot);
  return snapshot;
}

async function syncKnowledgeLinks(
  disk: KnowledgeDisk,
  workspaceId: string,
  path: string,
  markdown: string | null,
): Promise<void> {
  try {
    const current = await loadKnowledgeLinkSnapshot(disk, workspaceId);
    const next =
      markdown != null
        ? setKnowledgeLinkSource(
            current,
            path,
            extractOfficeMarkdownPaths(markdown),
          )
        : dropKnowledgeLinkSource(current, path);
    if (next.rev === current.rev) return;
    await saveKnowledgeLinkSnapshot(disk, workspaceId, next);
  } catch {
    // Disposable cache. The note already landed.
  }
}

async function syncKnowledgeLinksRemoved(
  disk: KnowledgeDisk,
  workspaceId: string,
  path: string,
): Promise<void> {
  try {
    const current = await loadKnowledgeLinkSnapshot(disk, workspaceId);
    const next = dropKnowledgeLinkPrefix(current, path);
    if (next.rev === current.rev) return;
    await saveKnowledgeLinkSnapshot(disk, workspaceId, next);
  } catch {
    // Disposable cache.
  }
}

export function nestKnowledgeTree(
  entries: KnowledgeEntry[],
): KnowledgeTreeNode[] {
  const dirs = new Map<string, KnowledgeTreeNode>();
  const roots: KnowledgeTreeNode[] = [];

  function dirNode(path: string, name: string): KnowledgeTreeNode {
    const existing = dirs.get(path);
    if (existing) return existing;
    const node: KnowledgeTreeNode = {
      path,
      name,
      kind: "dir",
      title: name,
      description: "",
      children: [],
    };
    dirs.set(path, node);
    return node;
  }

  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  for (const entry of sorted) {
    const parts = entry.path.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join("/");
      if (dirs.has(dirPath)) continue;
      const label = parts[i] ?? dirPath;
      const node = dirNode(dirPath, label);
      if (i === 0) roots.push(node);
      else dirs.get(parts.slice(0, i).join("/"))?.children.push(node);
    }
    const leaf: KnowledgeTreeNode = {
      path: entry.path,
      name: entry.name,
      kind: "file",
      title: entry.title,
      description: entry.description,
      encoding: entry.encoding,
      children: [],
    };
    if (parts.length === 1) roots.push(leaf);
    else dirs.get(parts.slice(0, -1).join("/"))?.children.push(leaf);
  }

  sortTree(roots);
  return roots;
}

export function filterKnowledgeTree(
  nodes: KnowledgeTreeNode[],
  query: string,
): KnowledgeTreeNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return nodes;
  const next: KnowledgeTreeNode[] = [];
  for (const node of nodes) {
    const self =
      node.name.toLowerCase().includes(needle) ||
      node.title.toLowerCase().includes(needle) ||
      node.description.toLowerCase().includes(needle);
    if (self && node.kind !== "dir") {
      next.push(node);
      continue;
    }
    const children = filterKnowledgeTree(node.children, query);
    if (children.length > 0 || (self && node.kind === "dir")) {
      next.push(self && node.kind === "dir" ? node : { ...node, children });
    }
  }
  return next;
}

export function knowledgeSkillWorkspace(
  disk: KnowledgeDisk,
  workspaceId: string,
): SkillWorkspace {
  const office = sanitizeWorkspaceId(workspaceId);
  const prefix = `${office}/`;
  return {
    async readFile(path) {
      return disk.getText(`${prefix}${normalizeRel(path)}`);
    },
    async glob(pattern) {
      const re = globRe(pattern);
      const objects = await disk.list(prefix);
      return objects
        .map((object) => object.key.slice(prefix.length))
        .filter((path) => path && re.test(path));
    },
    async readDir(path) {
      const rel = normalizeRel(path);
      const folder = rel ? `${prefix}${rel}/` : prefix;
      const objects = await disk.list(folder);
      const names = new Map<string, string>();
      for (const object of objects) {
        if (!object.key.startsWith(folder)) continue;
        const rest = object.key.slice(folder.length);
        if (!rest) continue;
        const cut = rest.indexOf("/");
        if (cut === -1) names.set(rest, "file");
        else names.set(rest.slice(0, cut), "directory");
      }
      return [...names.entries()].map(([name, type]) => ({ path: name, type }));
    },
    async stat(path) {
      const key = `${prefix}${normalizeRel(path)}`;
      const bytes = await disk.getBytes(key);
      return bytes ? { type: "file", size: bytes.byteLength } : null;
    },
  };
}

/**
 * Playbook sources for this bot: office knowledge first, then this computer.
 * Skip the office source when `officeId` is empty.
 */
export function botSkillSources(opts: {
  knowledge: KnowledgeDisk | null;
  officeId: string;
  workspace: SkillWorkspace;
}): WorkspaceSkillSource[] {
  const sources: WorkspaceSkillSource[] = [];
  if (opts.knowledge && opts.officeId) {
    sources.push(officeSkillSource(opts.knowledge, opts.officeId));
  }
  sources.push(workspaceSkillSource(opts.workspace));
  return sources;
}

export function officeSkillSource(
  disk: KnowledgeDisk,
  workspaceId: string,
): WorkspaceSkillSource {
  const workspace = knowledgeSkillWorkspace(disk, workspaceId);
  const id = "office:skills";
  let fingerprint = `${id}:empty`;
  let byName = new Map<string, OfficeIndexedSkill>();
  let indexed = false;

  async function reindex(): Promise<void> {
    const next = new Map<string, OfficeIndexedSkill>();
    const found = await workspace.glob?.("**");
    const paths = (Array.isArray(found) ? found : [])
      .filter((row): row is string => typeof row === "string")
      .filter((path) => isKnowledgeSkillFile(path))
      .sort();
    const parts: string[] = [];
    for (const path of paths) {
      if (next.size >= MAX_WORKSPACE_SKILLS) break;
      const raw = await workspace.readFile(path);
      if (!raw || raw.length > MAX_SKILL_BYTES) continue;
      const parsed = parseSkillMarkdown(raw);
      if (!parsed || next.has(parsed.name)) continue;
      const directory =
        path === SKILL_FILE ? "" : path.slice(0, -`/${SKILL_FILE}`.length);
      const resources = await listOfficeSkillResources(workspace, directory);
      const descriptor: SkillDescriptor = {
        name: parsed.name,
        description: parsed.description,
        compatibility: parsed.compatibility,
        license: parsed.license,
        allowedTools: parsed.allowedTools,
        metadata: parsed.metadata,
        sourceId: id,
      };
      next.set(parsed.name, {
        directory,
        descriptor,
        content: {
          ...descriptor,
          body: parsed.body,
          rawContent: raw,
          resources: resources.map((resource) => ({ ...resource })),
          path,
          directory,
        },
        resources,
      });
      parts.push(parsed.name, raw);
    }
    byName = next;
    fingerprint = `${id}:${parts.join("\0").length}:${next.size}`;
    indexed = true;
  }

  return {
    id,
    get fingerprint() {
      return fingerprint;
    },
    async list() {
      if (!indexed) await reindex();
      return [...byName.values()].map((skill) => ({ ...skill.descriptor }));
    },
    async load(name) {
      if (!indexed) await reindex();
      const skill = byName.get(name);
      return skill ? { ...skill.content } : null;
    },
    async readResource(name, path) {
      if (skillResourcePathError(path)) return null;
      if (!indexed) await reindex();
      const skill = byName.get(name);
      if (!skill) return null;
      const resource = skill.resources.find((entry) => entry.path === path);
      if (!resource || resource.encoding === "base64") return null;
      const full = skill.directory ? `${skill.directory}/${path}` : path;
      const content = await workspace.readFile(full);
      if (content == null) return null;
      return { ...resource, content };
    },
    async refresh() {
      await reindex();
    },
  };
}

export function mediaTypeForKnowledgePath(path: string): string {
  const file = path.split("/").at(-1) ?? path;
  const index = file.lastIndexOf(".");
  const ext = index === -1 ? "" : file.slice(index).toLowerCase();
  return MEDIA_TYPES[ext] ?? "application/octet-stream";
}

export function decodeKnowledgeBytes(raw: string): Uint8Array {
  const payload = raw.replace(/^data:[^;]*;base64,/iu, "").replace(/\s/g, "");
  if (!payload) return new Uint8Array();
  try {
    const buffer = (
      globalThis as { Buffer?: { from(data: string, enc: string): Uint8Array } }
    ).Buffer;
    if (buffer) return Uint8Array.from(buffer.from(payload, "base64"));
  } catch {
    // Fall through to atob.
  }
  let binary: string;
  try {
    binary = atob(payload);
  } catch {
    throw new KnowledgeWriteError("That file could not be decoded.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

type OfficeIndexedSkill = {
  directory: string;
  descriptor: SkillDescriptor;
  content: SkillContent;
  resources: SkillResourceDescriptor[];
};

async function listOfficeSkillResources(
  workspace: SkillWorkspace,
  directory: string,
): Promise<SkillResourceDescriptor[]> {
  if (!directory || !workspace.glob) return [];
  const found = await workspace.glob(`${directory}/**`);
  if (!Array.isArray(found)) return [];
  const resources: SkillResourceDescriptor[] = [];
  const seen = new Set<string>();
  const prefix = `${directory}/`;
  for (const row of found) {
    if (resources.length >= MAX_SKILL_RESOURCES) break;
    if (typeof row !== "string" || !row.startsWith(prefix)) continue;
    const path = row.slice(prefix.length);
    if (!path || path === SKILL_FILE || seen.has(path) || path.endsWith("/")) {
      continue;
    }
    if (skillResourcePathError(path)) continue;
    seen.add(path);
    const encoding = TEXT_EXTENSIONS.has(extensionOf(path)) ? "text" : "base64";
    const info = await workspace.stat?.(row);
    resources.push({
      path,
      kind: skillResourceKind(path),
      size: typeof info?.size === "number" ? info.size : undefined,
      encoding,
    });
  }
  return resources.sort((a, b) => a.path.localeCompare(b.path));
}

async function fileMeta(
  disk: KnowledgeDisk,
  office: string,
  path: string,
): Promise<{ title: string; description: string }> {
  const name = path.split("/").at(-1) ?? path;
  if (!isKnowledgeSkillFile(path)) {
    return { title: name, description: "" };
  }
  const raw = await disk.getText(`${office}/${path}`);
  const parsed = raw ? parseSkillMarkdown(raw) : null;
  return {
    title: parsed?.name ?? knowledgeSkillName(path) ?? name,
    description: parsed?.description ?? "",
  };
}

async function entryFromObject(
  disk: KnowledgeDisk,
  office: string,
  path: string,
  object: KnowledgeObject,
): Promise<KnowledgeEntry | null> {
  const name = path.split("/").at(-1) ?? path;
  const mediaType = mediaTypeForKnowledgePath(path);
  const encoding = TEXT_EXTENSIONS.has(extensionOf(name)) ? "text" : "binary";
  const meta = await fileMeta(disk, office, path);
  return {
    path,
    name,
    title: meta.title,
    description: meta.description,
    size: object.size,
    encoding,
    mediaType,
  };
}

function extensionOf(path: string): string {
  const file = path.split("/").at(-1) ?? path;
  const index = file.lastIndexOf(".");
  return index === -1 ? "" : file.slice(index).toLowerCase();
}

function isTextBytes(path: string, bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  const ext = extensionOf(path);
  if (ext && !TEXT_EXTENSIONS.has(ext)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function sortTree(nodes: KnowledgeTreeNode[]) {
  nodes.sort((a, b) => {
    if (a.kind === "dir" && b.kind !== "dir") return -1;
    if (a.kind !== "dir" && b.kind === "dir") return 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) sortTree(node.children);
}

function normalizeRel(path: string): string {
  return path.replace(/^\.?\//u, "").replace(/\/+$/u, "");
}

function globRe(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `^${escaped.replace(/\*\*/g, ":::").replace(/\*/g, "[^/]+").replace(/:::/g, ".*")}$`,
  );
}

const MEDIA_TYPES: Record<string, string> = {
  ".css": "text/css",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".htm": "text/html",
  ".html": "text/html",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".jsx": "text/javascript",
  ".md": "text/markdown",
  ".mjs": "text/javascript",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".py": "text/x-python",
  ".svg": "image/svg+xml",
  ".ts": "text/plain",
  ".tsx": "text/plain",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
};
