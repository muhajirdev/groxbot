/** Shared office tasks in knowledge — `tasks/<name>/TASK.md`, like skills. */

export const TASKS_ROOT = "tasks";
export const TASK_FILE = "TASK.md";
export const TASK_ACTIVITY_FILE = "activity.md";
export const MAX_WORKSPACE_TASKS = 200;
export const MAX_TASK_BYTES = 32_000;
export const MAX_TASK_ACTIVITY_BYTES = 64_000;

const TASK_NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const DEFAULT_TASK_STATUS: TaskStatus = "todo";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
  blocked: "Blocked",
};

const STATUS_SET = new Set<string>(TASK_STATUSES);

export type ParsedTask = {
  name: string;
  description: string;
  status: TaskStatus;
  body: string;
};

export type TaskActivityEntry = {
  at: string;
  author: string;
  body: string;
};

/** `tasks/<name>/TASK.md` */
export function taskFilePath(name: string): string {
  return `${TASKS_ROOT}/${name}/${TASK_FILE}`;
}

/** `tasks/<name>/activity.md` — comments/activity for that task. */
export function taskActivityPath(name: string): string {
  return `${TASKS_ROOT}/${name}/${TASK_ACTIVITY_FILE}`;
}

export function isTaskName(value: string): boolean {
  return TASK_NAME.test(value);
}

export function isKnowledgeTaskFile(path: string): boolean {
  const parts = path.split("/");
  return (
    parts.length === 3 &&
    parts[0] === TASKS_ROOT &&
    parts[2] === TASK_FILE &&
    isTaskName(parts[1] ?? "")
  );
}

export function isKnowledgeTaskActivityFile(path: string): boolean {
  const parts = path.split("/");
  return (
    parts.length === 3 &&
    parts[0] === TASKS_ROOT &&
    parts[2] === TASK_ACTIVITY_FILE &&
    isTaskName(parts[1] ?? "")
  );
}

export function knowledgeTaskName(path: string): string | null {
  if (!isKnowledgeTaskFile(path)) return null;
  return path.split("/")[1] ?? null;
}

export function parseTaskStatus(value: unknown): TaskStatus {
  if (typeof value === "string" && STATUS_SET.has(value)) {
    return value as TaskStatus;
  }
  return DEFAULT_TASK_STATUS;
}

export function parseTaskMarkdown(raw: string): ParsedTask | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  const data = parseFrontmatter(match[1] ?? "");
  const name = asString(data.name);
  const description = asString(data.description);
  if (!name || !description || !isTaskName(name)) return null;
  return {
    name,
    description,
    status: parseTaskStatus(data.status),
    body: match[2] ?? "",
  };
}

export function formatTaskMarkdown(input: {
  name: string;
  description: string;
  status?: TaskStatus;
  body: string;
}): string {
  const status = parseTaskStatus(input.status);
  const body = input.body.replace(/^\n+/u, "");
  return `---\nname: ${input.name}\ndescription: ${input.description}\nstatus: ${status}\n---\n${body}`;
}

const ACTIVITY_HEADING = /^##\s+(\d{4}-\d{2}-\d{2}T\S+)\s+(\S.*?)\s*$/;

export function parseTaskActivity(raw: string): TaskActivityEntry[] {
  const text = raw.replace(/^\uFEFF/, "");
  if (!text.trim()) return [];
  const lines = text.split(/\r?\n/);
  const entries: TaskActivityEntry[] = [];
  let current: TaskActivityEntry | null = null;
  const flush = () => {
    if (!current) return;
    current.body = current.body.replace(/^\n+/u, "").replace(/\n+$/u, "");
    entries.push(current);
    current = null;
  };
  for (const line of lines) {
    const heading = line.match(ACTIVITY_HEADING);
    if (heading) {
      flush();
      current = {
        at: heading[1] ?? "",
        author: (heading[2] ?? "").trim(),
        body: "",
      };
      continue;
    }
    if (current) {
      current.body = current.body ? `${current.body}\n${line}` : line;
    }
  }
  flush();
  return entries.filter((row) => row.at && row.author);
}

export function formatTaskActivity(
  entries: readonly TaskActivityEntry[],
): string {
  if (entries.length === 0) return "";
  return `${entries
    .map((row) => `## ${row.at} ${row.author}\n${row.body.trim()}\n`)
    .join("\n")
    .trimEnd()}\n`;
}

export function appendTaskActivity(
  raw: string,
  entry: TaskActivityEntry,
): string {
  const block = `## ${entry.at} ${sanitizeActivityAuthor(entry.author)}\n${entry.body.trim()}\n`;
  const base = raw.trimEnd();
  return base ? `${base}\n\n${block}` : block;
}

export function sanitizeActivityAuthor(value: string): string {
  const next = value.trim().replace(/\s+/g, " ").slice(0, 64);
  return next || "you";
}

export function slugFromTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return isTaskName(slug) ? slug : "";
}

export function uniqueTaskName(
  wanted: string,
  taken: ReadonlySet<string>,
): string | null {
  const base = isTaskName(wanted) ? wanted : slugFromTitle(wanted);
  if (!base) return null;
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const suffix = `-${n}`;
    const clipped = base.slice(0, Math.max(1, 64 - suffix.length));
    const next = `${clipped}${suffix}`;
    if (isTaskName(next) && !taken.has(next)) return next;
  }
  return null;
}

export function groupTasksByStatus<T extends { status?: string }>(
  tasks: readonly T[],
): Record<TaskStatus, T[]> {
  const grouped = Object.fromEntries(
    TASK_STATUSES.map((status) => [status, [] as T[]]),
  ) as Record<TaskStatus, T[]>;
  for (const task of tasks) {
    grouped[parseTaskStatus(task.status)].push(task);
  }
  return grouped;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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
