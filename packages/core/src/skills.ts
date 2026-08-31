/** Agent Skills on this bot’s computer. Not a Postgres catalog. */

export const SKILLS_ROOT = "skills";
export const SKILL_FILE = "SKILL.md";
export const MAX_WORKSPACE_SKILLS = 40;
export const MAX_SKILL_BYTES = 32_000;
export const MAX_SKILL_RESOURCES = 20;

const SKILL_NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;
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

export type SkillResourceKind = "reference" | "script" | "asset" | "file";

export type SkillDescriptor = {
  name: string;
  description: string;
  compatibility?: string;
  license?: string;
  allowedTools?: string;
  metadata?: Record<string, unknown>;
  sourceId?: string;
  version?: string;
};

export type SkillResourceDescriptor = {
  path: string;
  kind: SkillResourceKind;
  size?: number;
  encoding?: "text" | "base64";
  mimeType?: string;
};

export type SkillContent = SkillDescriptor & {
  body: string;
  rawContent?: string;
  resources?: SkillResourceDescriptor[];
};

export type SkillResource = SkillResourceDescriptor & { content: string };

export type SkillWorkspace = {
  readFile(path: string): Promise<string | null>;
  glob?(pattern: string): Promise<unknown>;
  readDir?(path: string, opts?: { limit?: number }): Promise<unknown>;
  stat?(
    path: string,
  ): Promise<{ type?: string; size?: number } | null>;
};

export type WorkspaceSkillSource = {
  id: string;
  readonly fingerprint: string;
  list(): Promise<SkillDescriptor[]>;
  load(name: string): Promise<SkillContent | null>;
  readResource(name: string, path: string): Promise<SkillResource | null>;
  refresh(): Promise<void>;
};

type IndexedSkill = {
  directory: string;
  descriptor: SkillDescriptor;
  content: SkillContent;
  resources: SkillResourceDescriptor[];
};

/** `skills/<name>/SKILL.md` */
export function skillFilePath(name: string): string {
  return `${SKILLS_ROOT}/${name}/${SKILL_FILE}`;
}

export function isSkillName(value: string): boolean {
  return SKILL_NAME.test(value);
}

export function skillResourceKind(path: string): SkillResourceKind {
  if (path.startsWith("references/")) return "reference";
  if (path.startsWith("scripts/")) return "script";
  if (path.startsWith("assets/")) return "asset";
  return "file";
}

export function skillResourcePathError(path: string): string | null {
  if (
    path.startsWith("/") ||
    path.includes("\0") ||
    path.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    return `Skill resource path must be a normalized relative path: ${path}`;
  }
  return null;
}

export function parseSkillMarkdown(raw: string): {
  name: string;
  description: string;
  body: string;
  compatibility?: string;
  license?: string;
  allowedTools?: string;
  metadata?: Record<string, unknown>;
} | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  const data = parseFrontmatter(match[1] ?? "");
  const name = asString(data.name);
  const description = asString(data.description);
  if (!name || !description || !isSkillName(name)) return null;
  const metadata = asRecord(data.metadata);
  return {
    name,
    description,
    body: match[2] ?? "",
    compatibility: asString(data.compatibility),
    license: asString(data.license),
    allowedTools: asString(data["allowed-tools"] ?? data.allowedTools),
    metadata,
  };
}

/**
 * Live catalog of Agent Skills in this bot’s Think workspace.
 * Add / edit / delete `skills/<name>/SKILL.md` with the file tools; Think
 * refreshes the catalog at the start of the next turn.
 */
export function workspaceSkillSource(
  workspace: SkillWorkspace,
  options: { id?: string } = {},
): WorkspaceSkillSource {
  const id = options.id ?? "workspace:skills";
  let fingerprint = `${id}:empty`;
  let byName = new Map<string, IndexedSkill>();
  let indexed = false;

  async function ensureIndexed(): Promise<void> {
    if (!indexed) await reindex();
  }

  async function reindex(): Promise<void> {
    const next = new Map<string, IndexedSkill>();
    const parts: string[] = [];
    const directories = await listSkillDirectories(workspace);
    for (const directory of directories) {
      if (next.size >= MAX_WORKSPACE_SKILLS) break;
      const skillPath = skillFilePath(directory);
      const raw = await workspace.readFile(skillPath);
      if (!raw || raw.length > MAX_SKILL_BYTES) continue;
      const parsed = parseSkillMarkdown(raw);
      if (!parsed || next.has(parsed.name)) continue;
      const resources = await listSkillResources(workspace, directory);
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
        },
        resources,
      });
      parts.push(parsed.name, raw);
      for (const resource of resources) {
        parts.push(resource.path, String(resource.size ?? 0));
      }
    }
    byName = next;
    fingerprint = `${id}:${stableHash(parts)}`;
    indexed = true;
  }

  return {
    id,
    get fingerprint() {
      return fingerprint;
    },
    async list() {
      await ensureIndexed();
      return [...byName.values()].map((skill) => ({ ...skill.descriptor }));
    },
    async load(name) {
      await ensureIndexed();
      const skill = byName.get(name);
      return skill ? { ...skill.content } : null;
    },
    async readResource(name, path) {
      if (skillResourcePathError(path)) return null;
      await ensureIndexed();
      const skill = byName.get(name);
      if (!skill) return null;
      const resource = skill.resources.find((entry) => entry.path === path);
      if (!resource || resource.encoding === "base64") return null;
      const content = await workspace.readFile(
        `${SKILLS_ROOT}/${skill.directory}/${path}`,
      );
      if (content == null) return null;
      return { ...resource, content };
    },
    async refresh() {
      await reindex();
    },
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseFrontmatter(raw: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    const key = trimmed.slice(0, colon).trim();
    if (!key) continue;
    data[key] = unquote(trimmed.slice(colon + 1).trim());
  }
  return data;
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function entryPath(entry: unknown): string | null {
  if (typeof entry === "string") return normalizePath(entry);
  if (!entry || typeof entry !== "object") return null;
  const row = entry as { path?: unknown; name?: unknown };
  if (typeof row.path === "string") return normalizePath(row.path);
  if (typeof row.name === "string") return normalizePath(row.name);
  return null;
}

function entryType(entry: unknown): string | undefined {
  if (!entry || typeof entry !== "object") return undefined;
  const type = (entry as { type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
}

function normalizePath(path: string): string {
  return path.replace(/^\.?\//, "").replace(/\/+$/, "");
}

function skillDirectoryFromPath(path: string): string | null {
  const normalized = normalizePath(path);
  const prefix = `${SKILLS_ROOT}/`;
  if (!normalized.startsWith(prefix)) return null;
  if (normalized.endsWith(`/${SKILL_FILE}`)) {
    const directory = normalized.slice(prefix.length, -`/${SKILL_FILE}`.length);
    return directory && !directory.includes("/") && isSkillName(directory)
      ? directory
      : null;
  }
  const rest = normalized.slice(prefix.length);
  if (!rest.includes("/") && isSkillName(rest)) return rest;
  return null;
}

async function listEntries(
  workspace: SkillWorkspace,
  globPattern: string,
  dir: string,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  try {
    if (workspace.glob) {
      const found = await workspace.glob(globPattern);
      if (Array.isArray(found)) rows.push(...found);
    }
  } catch {
    // Missing folders are empty.
  }
  try {
    if (workspace.readDir) {
      const found = await workspace.readDir(dir);
      if (Array.isArray(found)) {
        for (const entry of found) {
          const path = entryPath(entry);
          rows.push(
            path && !path.includes("/")
              ? { ...asObject(entry), path: `${dir}/${path}` }
              : entry,
          );
        }
      }
    }
  } catch {
    // Missing folders are empty.
  }
  return rows;
}

function asObject(entry: unknown): Record<string, unknown> {
  return entry !== null && typeof entry === "object"
    ? (entry as Record<string, unknown>)
    : {};
}

async function listSkillDirectories(
  workspace: SkillWorkspace,
): Promise<string[]> {
  const entries = await listEntries(
    workspace,
    `${SKILLS_ROOT}/*/SKILL.md`,
    SKILLS_ROOT,
  );
  const names = new Set<string>();
  for (const entry of entries) {
    const path = entryPath(entry);
    const fromPath = path ? skillDirectoryFromPath(path) : null;
    if (fromPath) {
      names.add(fromPath);
      continue;
    }
    const name = path?.split("/").pop() ?? null;
    if (name && isSkillName(name) && entryType(entry) !== "file") {
      names.add(name);
    }
  }
  return [...names].sort();
}

async function listSkillResources(
  workspace: SkillWorkspace,
  directory: string,
): Promise<SkillResourceDescriptor[]> {
  const root = `${SKILLS_ROOT}/${directory}`;
  const entries = await listEntries(workspace, `${root}/**`, root);
  const nested: unknown[] = [];
  for (const folder of ["references", "scripts", "assets"]) {
    nested.push(
      ...(await listEntries(
        workspace,
        `${root}/${folder}/**`,
        `${root}/${folder}`,
      )),
    );
  }
  const resources: SkillResourceDescriptor[] = [];
  const seen = new Set<string>();
  for (const entry of [...entries, ...nested]) {
    if (resources.length >= MAX_SKILL_RESOURCES) break;
    const full = entryPath(entry);
    if (!full?.startsWith(`${root}/`)) continue;
    const path = full.slice(`${root}/`.length);
    if (path === SKILL_FILE || seen.has(path)) continue;
    if (skillResourcePathError(path) || path.endsWith("/")) continue;
    if (entryType(entry) === "directory") continue;
    seen.add(path);
    const encoding = TEXT_EXTENSIONS.has(extensionOf(path)) ? "text" : "base64";
    const size = await resourceSize(workspace, full, entry);
    resources.push({
      path,
      kind: skillResourceKind(path),
      size,
      encoding,
    });
  }
  return resources.sort((a, b) => a.path.localeCompare(b.path));
}

async function resourceSize(
  workspace: SkillWorkspace,
  full: string,
  entry: unknown,
): Promise<number | undefined> {
  if (entry && typeof entry === "object") {
    const size = (entry as { size?: unknown }).size;
    if (typeof size === "number") return size;
  }
  const info = await workspace.stat?.(full);
  return typeof info?.size === "number" ? info.size : undefined;
}

function extensionOf(path: string): string {
  const file = path.split("/").at(-1) ?? path;
  const index = file.lastIndexOf(".");
  return index === -1 ? "" : file.slice(index).toLowerCase();
}

function stableHash(parts: string[]): string {
  let hash = 2166136261;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash ^= part.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 255;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
