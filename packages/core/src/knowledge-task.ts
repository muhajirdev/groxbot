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

export type TaskTrigger = {
  userId: string;
  name: string;
};

export type ParsedTask = {
  name: string;
  description: string;
  status: TaskStatus;
  body: string;
  triggeredBy?: string;
  triggeredByName?: string;
  triggeredAt?: string;
};

export type TaskActivityEntry = {
  at: string;
  author: string;
  authorId?: string;
  body: string;
};

const TRIGGER_ID = /^[A-Za-z0-9_-]{1,80}$/;
const ISO_AT = /^\d{4}-\d{2}-\d{2}T\S+$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVITY_AUTHOR_ID = /^(.*?)\s+@([A-Za-z0-9_-]{1,80})$/;

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
  const trigger = parseTaskTrigger({
    userId: asString(data.triggeredBy),
    name: asString(data.triggeredByName),
  });
  const triggeredAt = parseTriggeredAt(data.triggeredAt);
  return {
    name,
    description,
    status: parseTaskStatus(data.status),
    body: match[2] ?? "",
    ...(trigger
      ? {
          triggeredBy: trigger.userId,
          triggeredByName: trigger.name,
        }
      : {}),
    ...(triggeredAt ? { triggeredAt } : {}),
  };
}

export function formatTaskMarkdown(input: {
  name: string;
  description: string;
  status?: TaskStatus;
  body: string;
  triggeredBy?: string;
  triggeredByName?: string;
  triggeredAt?: string;
}): string {
  const status = parseTaskStatus(input.status);
  const body = input.body.replace(/^\n+/u, "");
  const trigger = parseTaskTrigger({
    userId: input.triggeredBy,
    name: input.triggeredByName,
  });
  const triggeredAt = parseTriggeredAt(input.triggeredAt);
  const extra = trigger
    ? `triggeredBy: ${yamlScalar(trigger.userId)}\ntriggeredByName: ${yamlScalar(trigger.name)}\ntriggeredAt: ${yamlScalar(triggeredAt ?? new Date().toISOString())}\n`
    : "";
  return `---\nname: ${yamlScalar(input.name)}\ndescription: ${yamlScalar(input.description)}\nstatus: ${status}\n${extra}---\n${body}`;
}

/** Fill missing `triggeredBy` on a TASK.md. Never steal an existing owner. */
export function stampTaskMarkdown(
  raw: string,
  trigger: TaskTrigger,
  at = new Date().toISOString(),
  previous?: ParsedTask | null,
): string {
  const parsed = parseTaskMarkdown(raw);
  if (!parsed) return raw;
  const existing =
    parseTaskTrigger({
      userId: parsed.triggeredBy ?? previous?.triggeredBy,
      name: parsed.triggeredByName ?? previous?.triggeredByName,
    }) ?? trigger;
  return formatTaskMarkdown({
    ...parsed,
    triggeredBy: existing.userId,
    triggeredByName: existing.name,
    triggeredAt: parsed.triggeredAt || previous?.triggeredAt || at,
  });
}

export function parseTaskTrigger(value: {
  userId?: string;
  name?: string;
}): TaskTrigger | null {
  const userId = (value.userId ?? "").trim();
  const name = (value.name ?? "").trim().replace(/\s+/g, " ").slice(0, 64);
  if (!TRIGGER_ID.test(userId)) return null;
  return { userId, name: name || userId };
}

export function parseTriggeredAt(value: unknown): string | undefined {
  const text = asString(value);
  if (!text || !ISO_AT.test(text)) return undefined;
  return text;
}

export function isoDayFromAt(value: string): string | null {
  const day = value.trim().slice(0, 10);
  return ISO_DAY.test(day) ? day : null;
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
      const parsed = parseActivityAuthor((heading[2] ?? "").trim());
      current = {
        at: heading[1] ?? "",
        author: parsed.author,
        ...(parsed.authorId ? { authorId: parsed.authorId } : {}),
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
    .map(
      (row) =>
        `## ${row.at} ${formatActivityAuthor(row)}\n${row.body.trim()}\n`,
    )
    .join("\n")
    .trimEnd()}\n`;
}

export function appendTaskActivity(
  raw: string,
  entry: TaskActivityEntry,
): string {
  const block = `## ${entry.at} ${formatActivityAuthor(entry)}\n${entry.body.trim()}\n`;
  const base = raw.trimEnd();
  return base ? `${base}\n\n${block}` : block;
}

export function sanitizeActivityAuthor(value: string): string {
  const next = value.trim().replace(/\s+/g, " ").slice(0, 64);
  return next || "you";
}

function parseActivityAuthor(value: string): {
  author: string;
  authorId?: string;
} {
  const tagged = value.match(ACTIVITY_AUTHOR_ID);
  if (tagged) {
    const author = sanitizeActivityAuthor(tagged[1] ?? "");
    const authorId = tagged[2] ?? "";
    return TRIGGER_ID.test(authorId) ? { author, authorId } : { author };
  }
  return { author: sanitizeActivityAuthor(value) };
}

function formatActivityAuthor(
  entry: Pick<TaskActivityEntry, "author" | "authorId">,
): string {
  const author = sanitizeActivityAuthor(entry.author);
  const authorId = (entry.authorId ?? "").trim();
  return TRIGGER_ID.test(authorId) ? `${author} @${authorId}` : author;
}

/**
 * If the newest activity line has no human id, attribute it to the
 * person who asked this turn — never leave bot-only authorship.
 */
export function stampTaskActivity(raw: string, trigger: TaskTrigger): string {
  const entries = parseTaskActivity(raw);
  if (entries.length === 0) return raw;
  const last = entries[entries.length - 1];
  if (!last || last.authorId) return raw;
  const next = entries.slice();
  next[next.length - 1] = {
    ...last,
    author: trigger.name,
    authorId: trigger.userId,
  };
  return formatTaskActivity(next);
}

export function stampKnowledgeTaskWrite(
  path: string,
  content: string,
  trigger: TaskTrigger | null | undefined,
  previous?: ParsedTask | null,
): string {
  if (!trigger) return content;
  if (isKnowledgeTaskFile(path)) {
    return stampTaskMarkdown(
      content,
      trigger,
      new Date().toISOString(),
      previous,
    );
  }
  if (isKnowledgeTaskActivityFile(path)) {
    return stampTaskActivity(content, trigger);
  }
  return content;
}

function yamlScalar(value: string): string {
  if (
    value === "" ||
    /[:#[\]{},&*!|>'"%@`]/.test(value) ||
    /^\s|\s$/.test(value) ||
    /[\n\r]/.test(value)
  ) {
    return JSON.stringify(value);
  }
  return value;
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
