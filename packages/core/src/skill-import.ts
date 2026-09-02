/** Copy a public Agent Skill into the office knowledge tree. */

import {
  MAX_COMPUTER_WRITE_BYTES,
  type KnowledgeWrite,
} from "@groxbot/contracts";
import { encodeComputerBytes } from "./computer.js";
import {
  officeSkillSource,
  writeKnowledge,
  type KnowledgeDisk,
} from "./knowledge.js";
import {
  MAX_SKILL_BYTES,
  MAX_SKILL_RESOURCES,
  MAX_WORKSPACE_SKILLS,
  SKILL_FILE,
  isSkillName,
  parseSkillMarkdown,
  skillFilePath,
  skillResourcePathError,
} from "./skills.js";

export class SkillImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillImportError";
  }
}

export type SkillImportSource = {
  owner: string;
  repo: string;
  ref?: string;
  path?: string;
  skill?: string;
};

export type SkillImportInput = {
  source: string;
  name?: string;
};

export type SkillImportHit = {
  name: string;
  path: string;
  description: string;
};

export type SkillImportSkip = {
  name: string;
  reason: string;
};

export type SkillImportResult = {
  imported: SkillImportHit[];
  skipped: SkillImportSkip[];
};

export type SkillImportHttp = {
  getJson(url: string): Promise<unknown>;
  getBytes(url: string): Promise<Uint8Array>;
};

const GITHUB_NAME = /^[A-Za-z0-9_.-]+$/;
const SKILL_IMPORT_HOSTS = new Set([
  "github.com",
  "api.github.com",
  "raw.githubusercontent.com",
]);
const CONTAINERS = [
  "skills",
  "skills/.curated",
  "skills/.experimental",
  "skills/.system",
];
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
const MAX_IMPORT_JSON_BYTES = 2_000_000;
const USER_AGENT = "Groxbot";

export function parseSkillImportSource(raw: string): SkillImportSource {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new SkillImportError("Paste a GitHub repo or a SKILL.md URL.");
  }
  if (/^(www\.)?github\.com\//iu.test(trimmed)) {
    return parseGithubUrl(`https://${trimmed}`);
  }
  if (!trimmed.includes("://")) return parseOwnerRepo(trimmed);
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new SkillImportError("Paste a GitHub repo or a SKILL.md URL.");
  }
  const host = url.hostname.replace(/^www\./iu, "").toLowerCase();
  if (host === "skills.sh") return parseOwnerRepo(url.pathname);
  if (host === "raw.githubusercontent.com") return parseRawUrl(url);
  if (host === "github.com") return parseGithubUrl(url.toString());
  throw new SkillImportError(
    "Import a GitHub repo or a SKILL.md on GitHub.",
  );
}

export function discoverSkillMarkdownPaths(
  files: string[],
  prefix = "",
): string[] {
  const scoped = files.map(normalizeRel).filter(Boolean);
  const root = normalizeRel(prefix);
  if (root && isSkillFile(root)) {
    return scoped.includes(root) ? [root] : [];
  }
  const under = root
    ? scoped.filter(
        (path) => path === root || path.startsWith(`${root}/`),
      )
    : scoped;
  const found = new Set<string>();
  if (root) {
    for (const path of skillFilesAtDepth(under, root, 3)) found.add(path);
  } else {
    if (under.includes(SKILL_FILE)) found.add(SKILL_FILE);
    for (const container of CONTAINERS) {
      for (const path of skillFilesAtDepth(under, container, 3)) {
        found.add(path);
      }
    }
  }
  return shadowNested([...found].sort());
}

export function assertSkillImportUrl(url: URL): void {
  if (url.protocol !== "https:") {
    throw new SkillImportError("Import only works over HTTPS.");
  }
  if (url.username || url.password) {
    throw new SkillImportError("That URL is not allowed.");
  }
  const host = url.hostname.replace(/^www\./iu, "").toLowerCase();
  if (!SKILL_IMPORT_HOSTS.has(host) || looksLikeIp(host)) {
    throw new SkillImportError(
      "Import a GitHub repo or a SKILL.md on GitHub.",
    );
  }
}

export function createSkillImportHttp(
  fetchImpl: typeof fetch = fetch,
): SkillImportHttp {
  return {
    getJson: (url) =>
      readImport(fetchImpl, url, MAX_IMPORT_JSON_BYTES).then((bytes) => {
        try {
          return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
        } catch {
          throw new SkillImportError("Could not read that GitHub repo.");
        }
      }),
    getBytes: (url) => readImport(fetchImpl, url, MAX_COMPUTER_WRITE_BYTES),
  };
}

export async function importOfficeSkills(
  disk: KnowledgeDisk,
  workspaceId: string,
  input: SkillImportInput,
  http: SkillImportHttp,
): Promise<SkillImportResult> {
  const parsed = parseSkillImportSource(input.source);
  const skillFilter = input.name?.trim() || parsed.skill;
  if (skillFilter && !isSkillName(skillFilter)) {
    throw new SkillImportError("That skill name is not valid.");
  }
  const ref = parsed.ref || (await defaultBranch(http, parsed.owner, parsed.repo));
  const tree = await repoTree(http, parsed.owner, parsed.repo, ref);
  const skillFiles = discoverSkillMarkdownPaths(tree, parsed.path);
  if (skillFiles.length === 0) {
    throw new SkillImportError("No SKILL.md in that repo.");
  }

  const existing = new Set(
    (await officeSkillSource(disk, workspaceId).list()).map((row) => row.name),
  );
  const imported: SkillImportHit[] = [];
  const skipped: SkillImportSkip[] = [];
  const seen = new Set<string>();

  for (const skillPath of skillFiles) {
    if (imported.length + existing.size >= MAX_WORKSPACE_SKILLS) {
      skipped.push({
        name: leafSkillName(skillPath) || skillPath,
        reason: "Office already has 40 playbooks.",
      });
      continue;
    }
    const rawBytes = await http.getBytes(
      rawUrl(parsed.owner, parsed.repo, ref, skillPath),
    );
    if (rawBytes.byteLength > MAX_SKILL_BYTES) {
      skipped.push({
        name: leafSkillName(skillPath) || skillPath,
        reason: "That SKILL.md is too large.",
      });
      continue;
    }
    const raw = new TextDecoder().decode(rawBytes);
    const skill = parseSkillMarkdown(raw);
    if (!skill) {
      skipped.push({
        name: leafSkillName(skillPath) || skillPath,
        reason: "That file is not a skill (needs YAML name + description).",
      });
      continue;
    }
    if (skillFilter && skill.name !== skillFilter) continue;
    if (seen.has(skill.name) || existing.has(skill.name)) {
      skipped.push({
        name: skill.name,
        reason: existing.has(skill.name)
          ? "Already in the office."
          : "Duplicate name in that repo.",
      });
      continue;
    }
    seen.add(skill.name);
    const destRoot = skillFilePath(skill.name).slice(0, -`/${SKILL_FILE}`.length);
    await writeImportedFile(disk, workspaceId, `${destRoot}/${SKILL_FILE}`, rawBytes);
    const directory =
      skillPath === SKILL_FILE ? "" : skillPath.slice(0, -`/${SKILL_FILE}`.length);
    const resources = resourcePaths(tree, directory);
    for (const resource of resources) {
      const bytes = await http.getBytes(
        rawUrl(parsed.owner, parsed.repo, ref, resource.full),
      );
      if (bytes.byteLength > MAX_COMPUTER_WRITE_BYTES) continue;
      await writeImportedFile(
        disk,
        workspaceId,
        `${destRoot}/${resource.rel}`,
        bytes,
      );
    }
    existing.add(skill.name);
    imported.push({
      name: skill.name,
      path: `${destRoot}/${SKILL_FILE}`,
      description: skill.description,
    });
  }

  if (skillFilter && imported.length === 0 && skipped.length === 0) {
    throw new SkillImportError(`No skill named ${skillFilter} in that repo.`);
  }
  if (imported.length === 0 && skipped.length === 0) {
    throw new SkillImportError("No SKILL.md in that repo.");
  }
  if (imported.length === 0 && skipped.every((row) => row.reason.includes("not a skill"))) {
    throw new SkillImportError("No valid SKILL.md in that repo.");
  }
  return { imported, skipped };
}

function parseOwnerRepo(pathname: string): SkillImportSource {
  const parts = normalizeRel(pathname).split("/").filter(Boolean);
  if (parts.length < 2 || parts.length > 3) {
    throw new SkillImportError("Paste owner/repo, or owner/repo/skill-name.");
  }
  const owner = parts[0] ?? "";
  const repo = (parts[1] ?? "").replace(/\.git$/u, "");
  const skill = parts[2];
  if (!GITHUB_NAME.test(owner) || !GITHUB_NAME.test(repo)) {
    throw new SkillImportError("Paste owner/repo, or owner/repo/skill-name.");
  }
  if (skill && !isSkillName(skill)) {
    throw new SkillImportError("That skill name is not valid.");
  }
  return { owner, repo, skill };
}

function parseGithubUrl(raw: string): SkillImportSource {
  const url = new URL(raw);
  assertSkillImportUrl(url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new SkillImportError("Paste a GitHub repo or a SKILL.md URL.");
  }
  const owner = parts[0] ?? "";
  const repo = (parts[1] ?? "").replace(/\.git$/u, "");
  if (!GITHUB_NAME.test(owner) || !GITHUB_NAME.test(repo)) {
    throw new SkillImportError("Paste a GitHub repo or a SKILL.md URL.");
  }
  if (parts.length === 2) return { owner, repo };
  const kind = parts[2];
  if (kind !== "tree" && kind !== "blob") {
    throw new SkillImportError("Paste a GitHub repo or a SKILL.md URL.");
  }
  const ref = parts[3];
  if (!ref) throw new SkillImportError("Paste a GitHub repo or a SKILL.md URL.");
  const path = parts.slice(4).join("/");
  return { owner, repo, ref, path: path || undefined };
}

function parseRawUrl(url: URL): SkillImportSource {
  assertSkillImportUrl(url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 4) {
    throw new SkillImportError("Paste a GitHub repo or a SKILL.md URL.");
  }
  const [owner, repo, ref, ...rest] = parts;
  if (!owner || !repo || !ref || !GITHUB_NAME.test(owner) || !GITHUB_NAME.test(repo)) {
    throw new SkillImportError("Paste a GitHub repo or a SKILL.md URL.");
  }
  return { owner, repo, ref, path: rest.join("/") };
}

function skillFilesAtDepth(
  files: string[],
  container: string,
  maxDepth: number,
): string[] {
  const prefix = container ? `${container}/` : "";
  const found: string[] = [];
  for (const path of files) {
    if (!isSkillFile(path)) continue;
    if (container && path !== `${container}/${SKILL_FILE}` && !path.startsWith(prefix)) {
      continue;
    }
    if (!container && path !== SKILL_FILE && !path.startsWith(prefix)) continue;
    const rel =
      path === `${container}/${SKILL_FILE}`
        ? SKILL_FILE
        : container
          ? path.slice(prefix.length)
          : path;
    const folder = rel === SKILL_FILE ? "" : rel.slice(0, -`/${SKILL_FILE}`.length);
    const depth = folder ? folder.split("/").length : 0;
    if (depth > maxDepth) continue;
    found.push(path);
  }
  return found;
}

function shadowNested(paths: string[]): string[] {
  const set = new Set(paths);
  return paths.filter((path) => {
    const folder =
      path === SKILL_FILE ? "" : path.slice(0, -`/${SKILL_FILE}`.length);
    if (!folder) return true;
    const parts = folder.split("/");
    for (let i = 1; i < parts.length; i++) {
      const parent = `${parts.slice(0, i).join("/")}/${SKILL_FILE}`;
      if (set.has(parent)) return false;
    }
    return true;
  });
}

function resourcePaths(
  tree: string[],
  directory: string,
): Array<{ full: string; rel: string }> {
  if (!directory) return [];
  const prefix = `${directory}/`;
  const rows: Array<{ full: string; rel: string }> = [];
  for (const path of tree) {
    if (rows.length >= MAX_SKILL_RESOURCES) break;
    if (!path.startsWith(prefix)) continue;
    const rel = path.slice(prefix.length);
    if (!rel || rel === SKILL_FILE || rel.endsWith(`/${SKILL_FILE}`)) continue;
    if (skillResourcePathError(rel)) continue;
    rows.push({ full: path, rel });
  }
  return rows;
}

async function defaultBranch(
  http: SkillImportHttp,
  owner: string,
  repo: string,
): Promise<string> {
  const data = await http.getJson(
    `https://api.github.com/repos/${owner}/${repo}`,
  );
  const branch =
    data && typeof data === "object" && "default_branch" in data
      ? String((data as { default_branch?: unknown }).default_branch ?? "")
      : "";
  if (!branch) throw new SkillImportError("Could not read that GitHub repo.");
  return branch;
}

async function repoTree(
  http: SkillImportHttp,
  owner: string,
  repo: string,
  ref: string,
): Promise<string[]> {
  const data = await http.getJson(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
  );
  const tree =
    data && typeof data === "object" && "tree" in data
      ? (data as { tree?: unknown }).tree
      : null;
  if (!Array.isArray(tree)) {
    throw new SkillImportError("Could not read that GitHub repo.");
  }
  return tree
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const row = entry as { path?: unknown; type?: unknown };
      if (row.type !== "blob" || typeof row.path !== "string") return "";
      return normalizeRel(row.path);
    })
    .filter(Boolean);
}

async function writeImportedFile(
  disk: KnowledgeDisk,
  workspaceId: string,
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  const input: KnowledgeWrite = isTextPath(path)
    ? { path, content: new TextDecoder().decode(bytes), encoding: "text" }
    : {
        path,
        content: encodeComputerBytes(bytes),
        encoding: "base64",
      };
  await writeKnowledge(disk, workspaceId, input);
}

async function readImport(
  fetchImpl: typeof fetch,
  url: string,
  maxBytes: number,
): Promise<Uint8Array> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SkillImportError("Paste a GitHub repo or a SKILL.md URL.");
  }
  assertSkillImportUrl(parsed);
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/vnd.github+json, text/plain, */*",
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "follow",
  });
  let finalUrl: URL;
  try {
    finalUrl = new URL(response.url || url);
  } catch {
    throw new SkillImportError("That URL is not allowed.");
  }
  assertSkillImportUrl(finalUrl);
  if (response.status === 404) {
    throw new SkillImportError("Could not find that GitHub repo.");
  }
  if (response.status === 403) {
    throw new SkillImportError(
      "GitHub is rate-limiting skill imports. Try again later.",
    );
  }
  if (!response.ok) {
    throw new SkillImportError("Could not read that GitHub repo.");
  }
  const length = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > maxBytes) {
    throw new SkillImportError("That file is too large to import.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw new SkillImportError("That file is too large to import.");
  }
  return bytes;
}

function rawUrl(
  owner: string,
  repo: string,
  ref: string,
  path: string,
): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
}

function isSkillFile(path: string): boolean {
  return path === SKILL_FILE || path.endsWith(`/${SKILL_FILE}`);
}

function leafSkillName(path: string): string {
  const folder =
    path === SKILL_FILE ? "" : path.slice(0, -`/${SKILL_FILE}`.length);
  return folder.split("/").filter(Boolean).at(-1) ?? "";
}

function isTextPath(path: string): boolean {
  const file = path.split("/").at(-1) ?? path;
  const index = file.lastIndexOf(".");
  const ext = index === -1 ? "" : file.slice(index).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function looksLikeIp(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/u.test(host) || host.includes(":");
}

function normalizeRel(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/u, "").replace(/\/+$/u, "");
}
