/** `/skill` in office chat is an explicit playbook invoke, not a file search. */

export type OfficeSkillSlash = {
  name: string;
  input: string;
};

export type OfficeSkillSlashTurn = {
  system: string;
  forceActivate: boolean;
};

const SKILL_SLASH = /^\/([a-z0-9][a-z0-9_-]{0,63})(?:\s+([\s\S]*))?$/u;

export function parseOfficeSkillSlash(text: string): OfficeSkillSlash | null {
  const match = text.trim().match(SKILL_SLASH);
  if (!match?.[1]) return null;
  return { name: match[1], input: (match[2] ?? "").trim() };
}

export function lastUserText(messages: readonly unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") continue;
    const row = msg as { role?: unknown; content?: unknown };
    if (row.role !== "user") continue;
    const text = modelContentText(row.content);
    if (text) return text;
  }
  return "";
}

export function catalogHasSkill(system: string, name: string): boolean {
  return new RegExp(`^- ${escapeRegExp(name)}:`, "m").test(system);
}

export function withOfficeSkillSlashHint(
  system: string,
  skill: OfficeSkillSlash,
): string {
  const rest = skill.input
    ? ` Remaining text after /${skill.name} is the user's input for this skill.`
    : "";
  const hint = `The user invoked the /${skill.name} office skill. Call activate_skill with name "${skill.name}" before any other tool.${rest}`;
  if (system.includes(hint)) return system;
  return `${system.trimEnd()}\n\n${hint}`;
}

/** Force `activate_skill` when the user sent a cataloged `/skill`. */
export function officeSkillSlashTurn(input: {
  system: string;
  messages: readonly unknown[];
  continuation?: boolean;
  hasActivateSkill: boolean;
}): OfficeSkillSlashTurn {
  const system = input.system;
  if (input.continuation) return { system, forceActivate: false };
  const invoked = parseOfficeSkillSlash(lastUserText(input.messages));
  if (
    !invoked ||
    !input.hasActivateSkill ||
    !catalogHasSkill(system, invoked.name)
  ) {
    return { system, forceActivate: false };
  }
  return {
    system: withOfficeSkillSlashHint(system, invoked),
    forceActivate: true,
  };
}

function modelContentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const row = part as { type?: unknown; text?: unknown };
    if (row.type === "text" && typeof row.text === "string") {
      parts.push(row.text);
    }
  }
  return parts.join("");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
