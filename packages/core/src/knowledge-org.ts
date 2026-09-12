/** Office notes at the knowledge root — same family as skills/tasks. */

export const ORG_KNOWLEDGE_PATH = "org.md";
export const GOAL_KNOWLEDGE_PATH = "goal.md";

export const MAX_ORG_NAME = 80;
export const MAX_ORG_TEAM = 240;
export const MAX_ORG_GOAL = 2_000;

export function formatOrgMarkdown(input: {
  name: string;
  team?: string | null;
}): string {
  const name = clip(input.name, MAX_ORG_NAME);
  const team = clip(input.team ?? "", MAX_ORG_TEAM);
  const lines = ["---", `title: ${yamlString(name)}`];
  if (team) lines.push(`oneline: ${yamlString(team)}`);
  lines.push("---", "", `# ${name}`);
  if (team) lines.push("", team);
  return `${lines.join("\n")}\n`;
}

export function formatGoalMarkdown(goal: string): string | null {
  const body = clip(goal, MAX_ORG_GOAL);
  if (!body) return null;
  const oneline = firstLine(body, 120);
  return `---\ntitle: What we're building\noneline: ${yamlString(oneline)}\n---\n\n${body}\n`;
}

/** Files onboarding (and office create) write into the knowledge library. */
export function officeOrgKnowledgeFiles(input: {
  name: string;
  team?: string | null;
  goal?: string | null;
}): Array<{ path: string; content: string }> {
  const name = clip(input.name, MAX_ORG_NAME);
  if (!name) return [];
  const files = [
    {
      path: ORG_KNOWLEDGE_PATH,
      content: formatOrgMarkdown({ name, team: input.team }),
    },
  ];
  const goal = formatGoalMarkdown(input.goal ?? "");
  if (goal) files.push({ path: GOAL_KNOWLEDGE_PATH, content: goal });
  return files;
}

function clip(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function firstLine(value: string, max: number): string {
  const line = value.split(/\n/)[0]?.trim() ?? value;
  return clip(line, max);
}

function yamlString(value: string): string {
  if (
    /[:#{}[\],&*?|<>=!%@`'"\\]/.test(value) ||
    /^\s|\s$/.test(value) ||
    value.includes("\n")
  ) {
    return JSON.stringify(value);
  }
  return value;
}
