/**
 * Pi skills on the office library: catalog in the system prompt, `/skill:name`
 * injects SKILL.md. No activate_skill — the model reads the file (knowledge.read).
 */

import type { OfficeSkillCatalogEntry } from "./office-skill.js";

export type OfficeSkillSlash = {
  name: string;
  input: string;
};

const SKILL_SLASH_PI =
  /^\/skill:([a-z0-9][a-z0-9_-]{0,63})(?:\s+([\s\S]*))?$/u;
const SKILL_SLASH_SHORT =
  /^\/([a-z0-9][a-z0-9_-]{0,63})(?:\s+([\s\S]*))?$/u;

export function parseOfficeSkillSlash(text: string): OfficeSkillSlash | null {
  const trimmed = text.trim();
  const pi = trimmed.match(SKILL_SLASH_PI);
  if (pi?.[1]) return { name: pi[1], input: (pi[2] ?? "").trim() };
  const short = trimmed.match(SKILL_SLASH_SHORT);
  if (!short?.[1] || short[1] === "skill") return null;
  return { name: short[1], input: (short[2] ?? "").trim() };
}

export function lastUserText(messages: readonly unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") continue;
    const row = msg as {
      role?: unknown;
      content?: unknown;
      parts?: unknown;
    };
    if (row.role !== "user") continue;
    const text = modelContentText(row.parts) || modelContentText(row.content);
    if (text) return text;
  }
  return "";
}

/** Pi / Agent Skills: names + descriptions only. Full SKILL.md loads on demand. */
export const OFFICE_SKILL_CATALOG_INSTRUCTIONS = [
  "The following skills provide specialized instructions for specific tasks.",
  "When a task matches a skill's description, load the SKILL.md at the listed location with knowledge.read({ path }) inside code before proceeding.",
  "When a skill references relative paths, resolve them against the skill directory (the parent of SKILL.md) in the office library.",
].join(" ");

export function formatAvailableSkillsXml(
  skills: readonly OfficeSkillCatalogEntry[],
): string {
  if (skills.length === 0) return "";
  const rows = skills.map((skill) => {
    return [
      "  <skill>",
      `    <name>${xmlText(skill.name)}</name>`,
      `    <description>${xmlText(skill.description)}</description>`,
      `    <location>${xmlText(skill.path)}</location>`,
      "  </skill>",
    ].join("\n");
  });
  return `<available_skills>\n${rows.join("\n")}\n</available_skills>`;
}

export function withOfficeSkillCatalog(
  system: string,
  skills: readonly OfficeSkillCatalogEntry[],
): string {
  if (skills.length === 0) return system;
  const block = `${OFFICE_SKILL_CATALOG_INSTRUCTIONS}\n\n${formatAvailableSkillsXml(skills)}`;
  if (system.includes("<available_skills>")) return system;
  return `${system.trimEnd()}\n\n${block}`;
}

/** Pi `/skill:name`: harness loads SKILL.md; leftover args become `User:`. */
export function withForcedSkillContent(
  system: string,
  skill: OfficeSkillCatalogEntry,
  input: string,
): string {
  const user = input.trim() ? `\n\nUser: ${input.trim()}` : "";
  const block = [
    `<skill_content name="${xmlText(skill.name)}">`,
    skill.body.trim(),
    "",
    `Skill directory: ${skill.directory || "."}`,
    "Relative paths in this skill are relative to the skill directory in the office library.",
    user,
    "</skill_content>",
  ]
    .filter((row) => row !== "")
    .join("\n");
  if (system.includes(`<skill_content name="${xmlText(skill.name)}">`)) {
    return system;
  }
  return `${system.trimEnd()}\n\n${block}`;
}

export function applyOfficeSkillsToSystem(opts: {
  system: string;
  messages: readonly unknown[];
  catalog: readonly OfficeSkillCatalogEntry[];
  continuation?: boolean;
  /** Skills load via knowledge.read inside code. Skip when that tool is off this turn. */
  canReadSkills?: boolean;
}): string {
  if (opts.canReadSkills === false) return opts.system;
  let system = withOfficeSkillCatalog(opts.system, opts.catalog);
  if (opts.continuation) return system;
  const invoked = parseOfficeSkillSlash(lastUserText(opts.messages));
  if (!invoked) return system;
  const skill = opts.catalog.find((row) => row.name === invoked.name);
  if (!skill) return system;
  return withForcedSkillContent(system, skill, invoked.input);
}

function xmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function modelContentText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const row = part as { type?: unknown; text?: unknown };
    if (row.type === "text" && typeof row.text === "string") {
      parts.push(row.text);
    }
  }
  return parts.join("").trim();
}
