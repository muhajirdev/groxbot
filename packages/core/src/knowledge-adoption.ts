/** Team adoption from attributed knowledge tasks. Not a spend cockpit. */

import {
  isoDayFromAt,
  type ParsedTask,
  type TaskActivityEntry,
} from "./knowledge-task.js";

export const ADOPTION_WEEKS = 53;

export type AdoptionMember = {
  userId: string;
  name: string;
  image?: string | null;
};

export type AdoptionTask = Pick<
  ParsedTask,
  "triggeredBy" | "triggeredByName" | "triggeredAt"
> & {
  activity?: readonly Pick<TaskActivityEntry, "at" | "author" | "authorId">[];
};

export type AdoptionPerson = {
  userId: string;
  name: string;
  image: string | null;
  taskCount: number;
  contributionCount: number;
};

export type AdoptionHeatCell = {
  date: string;
  count: number;
  future: boolean;
};

export type AdoptionMonthLabel = {
  label: string;
  weekIndex: number;
};

export type AdoptionSnapshot = {
  people: AdoptionPerson[];
  days: Map<string, number>;
  personDays: Map<string, Map<string, number>>;
  taskCount: number;
  contributionCount: number;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** GitHub-style contribution levels 0–4. */
export function adoptionHeatLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

export function buildAdoption(
  tasks: readonly AdoptionTask[],
  members: readonly AdoptionMember[],
): AdoptionSnapshot {
  const people = new Map<string, AdoptionPerson>();
  const days = new Map<string, number>();
  const personDays = new Map<string, Map<string, number>>();

  const remember = (
    userId: string,
    name: string,
    image: string | null,
  ): AdoptionPerson => {
    const existing = people.get(userId);
    if (existing) {
      if (!existing.image && image) existing.image = image;
      if (existing.name === existing.userId && name !== userId) {
        existing.name = name;
      }
      return existing;
    }
    const row: AdoptionPerson = {
      userId,
      name,
      image,
      taskCount: 0,
      contributionCount: 0,
    };
    people.set(userId, row);
    return row;
  };

  for (const member of members) {
    const userId = member.userId.trim();
    const name = member.name.trim();
    if (!userId || !name) continue;
    remember(userId, name, member.image ?? null);
  }

  const byName = new Map<string, string>();
  for (const person of people.values()) {
    byName.set(person.name.trim().toLowerCase(), person.userId);
  }

  const bumpDay = (userId: string, day: string) => {
    days.set(day, (days.get(day) ?? 0) + 1);
    const per = personDays.get(userId) ?? new Map<string, number>();
    per.set(day, (per.get(day) ?? 0) + 1);
    personDays.set(userId, per);
  };

  const resolvePerson = (
    task: AdoptionTask,
    activity?: Pick<TaskActivityEntry, "author" | "authorId">,
  ): AdoptionPerson | null => {
    if (activity?.authorId) {
      const named =
        members.find((row) => row.userId === activity.authorId)?.name ??
        activity.author;
      return remember(
        activity.authorId,
        named || activity.author,
        members.find((row) => row.userId === activity.authorId)?.image ?? null,
      );
    }
    const authorKey = activity?.author.trim().toLowerCase() ?? "";
    if (authorKey && byName.has(authorKey)) {
      const userId = byName.get(authorKey)!;
      return people.get(userId) ?? null;
    }
    if (task.triggeredBy) {
      return remember(
        task.triggeredBy,
        task.triggeredByName?.trim() || task.triggeredBy,
        members.find((row) => row.userId === task.triggeredBy)?.image ?? null,
      );
    }
    return null;
  };

  for (const task of tasks) {
    const owner = resolvePerson(task);
    if (owner) owner.taskCount += 1;
    const created = task.triggeredAt ? isoDayFromAt(task.triggeredAt) : null;
    if (owner && created) {
      owner.contributionCount += 1;
      bumpDay(owner.userId, created);
    }
    for (const row of task.activity ?? []) {
      const day = isoDayFromAt(row.at);
      if (!day) continue;
      const who = resolvePerson(task, row);
      if (!who) continue;
      who.contributionCount += 1;
      bumpDay(who.userId, day);
    }
  }

  const listed = [...people.values()].sort((a, b) => {
    if (b.taskCount !== a.taskCount) return b.taskCount - a.taskCount;
    if (b.contributionCount !== a.contributionCount) {
      return b.contributionCount - a.contributionCount;
    }
    return a.name.localeCompare(b.name);
  });

  return {
    people: listed,
    days,
    personDays,
    taskCount: tasks.length,
    contributionCount: [...days.values()].reduce((sum, n) => sum + n, 0),
  };
}

export function adoptionHeatmap(
  counts: ReadonlyMap<string, number>,
  now = new Date(),
  weeks = ADOPTION_WEEKS,
): { weeks: AdoptionHeatCell[][]; months: AdoptionMonthLabel[] } {
  const today = utcDay(now);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (weeks * 7 - 1));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const columns: AdoptionHeatCell[][] = [];
  const months: AdoptionMonthLabel[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const week: AdoptionHeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + w * 7 + d);
      const key = date.toISOString().slice(0, 10);
      const future = date.getTime() > today.getTime();
      week.push({
        date: key,
        count: future ? 0 : (counts.get(key) ?? 0),
        future,
      });
    }
    const first = week[0];
    if (first && !first.future) {
      const month = Number(first.date.slice(5, 7)) - 1;
      if (month !== lastMonth) {
        months.push({ label: MONTHS[month] ?? "", weekIndex: w });
        lastMonth = month;
      }
    }
    columns.push(week);
  }
  return { weeks: columns, months };
}

function utcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}
