/** Sibling `skill_manage` tool — procedural memory in the office library. */

import {
  KnowledgeFileError,
  type KnowledgeDisk,
  officeSkillSource,
  readKnowledge,
  removeKnowledge,
  writeKnowledge,
} from "./knowledge.js";
import {
  isSkillName,
  MAX_SKILL_BYTES,
  MAX_WORKSPACE_SKILLS,
  parseSkillMarkdown,
  skillFilePath,
} from "./skills.js";

export const SKILL_TOOL_NAME = "skill_manage";
export const SKILL_ACTIONS = ["create", "patch", "edit", "delete"] as const;
export type SkillAction = (typeof SKILL_ACTIONS)[number];

export const SKILL_TOOL_DESCRIPTION = [
  "Save or patch a reusable how-to. Office library, not this computer. This is procedural memory — set_context is who you are and facts you know.",
  "Actions: create (full SKILL.md), patch (oldText/newText — preferred), edit (full rewrite), delete.",
  "Path is skills/<name>/SKILL.md. YAML name + description required; YAML name must match `name`. Patch an existing skill before creating one.",
  "After a write, mention that path in one short line. Do not copy the whole thread in.",
].join(" ");

export type SkillToolInput = {
  action: string;
  name: string;
  content?: string;
  oldText?: string;
  newText?: string;
};

export type SkillToolResult =
  | { ok: true; action: SkillAction; path: string }
  | { ok: false; message: string };

export type OfficeSkillCatalogEntry = {
  name: string;
  description: string;
  path: string;
  directory: string;
  body: string;
};

/** Pi catalog: name + description + path. Body loads on demand or via `/skill:name`. */
export async function loadOfficeSkillCatalog(
  disk: KnowledgeDisk,
  workspaceId: string,
): Promise<OfficeSkillCatalogEntry[]> {
  const source = officeSkillSource(disk, workspaceId);
  const listed = await source.list();
  const out: OfficeSkillCatalogEntry[] = [];
  for (const row of listed) {
    if (!row.description.trim()) continue;
    const loaded = await source.load(row.name);
    if (!loaded) continue;
    const path = loaded.path || skillFilePath(row.name);
    const directory =
      loaded.directory ||
      (path === "SKILL.md" ? "" : path.replace(/\/SKILL\.md$/u, ""));
    out.push({
      name: row.name,
      description: row.description,
      path,
      directory,
      body: loaded.body,
    });
  }
  return out;
}

export function parseSkillAction(value: string): SkillAction | null {
  return SKILL_ACTIONS.includes(value as SkillAction)
    ? (value as SkillAction)
    : null;
}

export async function runOfficeSkill(
  disk: KnowledgeDisk,
  workspaceId: string,
  input: SkillToolInput,
): Promise<SkillToolResult> {
  const action = parseSkillAction(String(input.action ?? "").trim());
  if (!action) return { ok: false, message: "Use create, patch, edit, or delete." };
  const name = String(input.name ?? "").trim();
  if (!isSkillName(name)) {
    return {
      ok: false,
      message: "Skill name is lowercase letters, digits, hyphens, or underscores.",
    };
  }
  const path = skillFilePath(name);
  try {
    if (action === "create") return await createSkill(disk, workspaceId, name, path, input.content);
    if (action === "edit") return await rewriteSkill(disk, workspaceId, name, path, input.content);
    if (action === "patch") {
      return await patchSkill(
        disk,
        workspaceId,
        name,
        path,
        input.oldText,
        input.newText,
      );
    }
    return await deleteSkill(disk, workspaceId, name, path);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update that skill.";
    return { ok: false, message };
  }
}

async function createSkill(
  disk: KnowledgeDisk,
  workspaceId: string,
  name: string,
  path: string,
  raw: string | undefined,
): Promise<SkillToolResult> {
  const existing = await readSkillRaw(disk, workspaceId, path);
  if (existing != null) {
    return { ok: false, message: "That skill exists. Patch or edit it." };
  }
  const listed = await officeSkillSource(disk, workspaceId).list();
  if (listed.length >= MAX_WORKSPACE_SKILLS) {
    return { ok: false, message: "This office already has as many skills as it can keep." };
  }
  const content = requireSkillMarkdown(name, raw);
  if ("message" in content) return content;
  await writeKnowledge(disk, workspaceId, { path, content: content.text });
  return { ok: true, action: "create", path };
}

async function rewriteSkill(
  disk: KnowledgeDisk,
  workspaceId: string,
  name: string,
  path: string,
  raw: string | undefined,
): Promise<SkillToolResult> {
  const existing = await readSkillRaw(disk, workspaceId, path);
  if (existing == null) {
    return { ok: false, message: "No skill at that name. Create it first." };
  }
  const content = requireSkillMarkdown(name, raw);
  if ("message" in content) return content;
  await writeKnowledge(disk, workspaceId, { path, content: content.text });
  return { ok: true, action: "edit", path };
}

async function patchSkill(
  disk: KnowledgeDisk,
  workspaceId: string,
  name: string,
  path: string,
  oldText: string | undefined,
  newText: string | undefined,
): Promise<SkillToolResult> {
  const existing = await readSkillRaw(disk, workspaceId, path);
  if (existing == null) {
    return { ok: false, message: "No skill at that name. Create it first." };
  }
  const from = typeof oldText === "string" ? oldText : "";
  if (!from) return { ok: false, message: "patch needs oldText." };
  const to = typeof newText === "string" ? newText : "";
  const count = existing.split(from).length - 1;
  if (count === 0) return { ok: false, message: "oldText was not found." };
  if (count > 1) {
    return { ok: false, message: "oldText matches more than once. Use a longer unique snippet." };
  }
  const next = existing.replace(from, to);
  const parsed = parseSkillMarkdown(next);
  if (!parsed || parsed.name !== name) {
    return {
      ok: false,
      message: "Patch would break YAML name + description, or rename the skill.",
    };
  }
  if (next.length > MAX_SKILL_BYTES) {
    return { ok: false, message: "That skill would be too long." };
  }
  await writeKnowledge(disk, workspaceId, { path, content: next });
  return { ok: true, action: "patch", path };
}

async function deleteSkill(
  disk: KnowledgeDisk,
  workspaceId: string,
  name: string,
  path: string,
): Promise<SkillToolResult> {
  const existing = await readSkillRaw(disk, workspaceId, path);
  if (existing == null) {
    return { ok: false, message: "No skill at that name." };
  }
  const folder = `skills/${name}`;
  try {
    await removeKnowledge(disk, workspaceId, folder);
  } catch (error) {
    if (!(error instanceof KnowledgeFileError)) throw error;
    await removeKnowledge(disk, workspaceId, path);
  }
  return { ok: true, action: "delete", path };
}

async function readSkillRaw(
  disk: KnowledgeDisk,
  workspaceId: string,
  path: string,
): Promise<string | null> {
  try {
    const file = await readKnowledge(disk, workspaceId, path);
    return typeof file.content === "string" ? file.content : null;
  } catch (error) {
    if (error instanceof KnowledgeFileError) return null;
    throw error;
  }
}

function requireSkillMarkdown(
  name: string,
  raw: string | undefined,
): { text: string } | SkillToolResult {
  const text = typeof raw === "string" ? raw : "";
  if (!text.trim()) {
    return { ok: false, message: "create and edit need the full SKILL.md (YAML + body)." };
  }
  if (text.length > MAX_SKILL_BYTES) {
    return { ok: false, message: "That skill is too long." };
  }
  const parsed = parseSkillMarkdown(text);
  if (!parsed) {
    return {
      ok: false,
      message: "SKILL.md needs YAML frontmatter with name and description.",
    };
  }
  if (parsed.name !== name) {
    return { ok: false, message: "YAML name must match the skill name." };
  }
  return { text };
}
