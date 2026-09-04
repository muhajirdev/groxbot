/** This bot’s recurring jobs. Agents `this.schedule` on the home RoomActor — not a product table. */

import type { Routine } from "@groxbot/contracts";
import { newId } from "./ids.js";
import { parseRoutineClock } from "./routine-clock.js";

export { isIntervalSchedule, parseRoutineClock } from "./routine-clock.js";

export const DEFAULT_ROUTINE_TIMEZONE = "UTC";
export const MAX_ROUTINE_NAME = 80;
export const MAX_ROUTINE_PROMPT = 8000;
export const MAX_ROUTINE_SCHEDULE = 80;
export const MAX_ROUTINE_TIMEZONE = 80;

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const DAY_INDEX: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

export class RoutineError extends Error {
  constructor(message = "Could not save that routine.") {
    super(message);
    this.name = "RoutineError";
  }
}

export class RoutineScheduleError extends RoutineError {
  constructor(
    message = "Use a schedule like “every weekday at 09:00” or “every day at 22:00”.",
  ) {
    super(message);
    this.name = "RoutineScheduleError";
  }
}

export class RoutineNotFoundError extends RoutineError {
  constructor(message = "Routine not found.") {
    super(message);
    this.name = "RoutineNotFoundError";
  }
}

export type StoredRoutine = {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  timezone: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

export type RoutineCreateInput = {
  name: string;
  prompt: string;
  cron: string;
  timezone?: string;
};

export type ParsedRoutineSchedule = {
  schedule: string;
  timezone: string;
  kind: "interval" | "wall-clock";
};

/** What Agents `this.schedule` / `scheduleEvery` needs. Kernel stays off agents. */
export type AgentRoutineWhen =
  | { kind: "cron"; cron: string }
  | { kind: "interval"; intervalSeconds: number };

export function isoMillis(
  value: number | Date | string | null | undefined,
): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return new Date(value).toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export function toRoutineDto(
  botId: string,
  row: StoredRoutine,
  nextRunAt?: number | Date | string | null,
): Routine {
  return {
    id: row.id,
    botId,
    name: row.name,
    prompt: row.prompt,
    cron: row.schedule,
    timezone: row.timezone,
    active: row.active,
    nextRunAt: isoMillis(nextRunAt),
  };
}

export function formatRoutinePrompt(name: string, prompt: string): string {
  return `Scheduled routine: ${name}\n\n${prompt}`;
}

/** Cron when it fits; `scheduleEvery` for intervals cron cannot express. */
export function agentRoutineWhen(
  parsed: ParsedRoutineSchedule,
  at?: Date,
): AgentRoutineWhen {
  if (parsed.kind === "interval") {
    return intervalToAgentWhen(parsed.schedule);
  }
  return {
    kind: "cron",
    cron: wallClockToUtcCron(parsed.schedule, parsed.timezone, at),
  };
}

export function prepareRoutineCreate(input: RoutineCreateInput): {
  name: string;
  prompt: string;
  parsed: ParsedRoutineSchedule;
  when: AgentRoutineWhen;
} {
  const name = input.name.trim();
  const prompt = input.prompt.trim();
  if (!name || name.length > MAX_ROUTINE_NAME) {
    throw new RoutineError("Name the routine.");
  }
  if (!prompt || prompt.length > MAX_ROUTINE_PROMPT) {
    throw new RoutineError("Say what this routine should do.");
  }
  const parsed = parseRoutineSchedule(input.cron, input.timezone);
  return { name, prompt, parsed, when: agentRoutineWhen(parsed) };
}

/** Agents `Schedule.time` is unix seconds. */
export function isoUnixSeconds(
  value: number | null | undefined,
): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

export function parseRoutineSchedule(
  raw: string,
  timezone?: string,
): ParsedRoutineSchedule {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_ROUTINE_SCHEDULE) {
    throw new RoutineScheduleError();
  }
  const inline = /^(.*) in ([A-Za-z_][A-Za-z0-9_+\-/]*)$/.exec(
    trimmed.replace(/\s+/g, " "),
  );
  const body = (inline?.[1] ?? trimmed).trim();
  const fromInline = inline?.[2];
  const zone = normalizeTimezone(fromInline ?? timezone);
  const parsed = tryParseWallClockSchedule(body, zone);
  if (parsed) return parsed;
  const cron = tryParseCronSchedule(body, zone);
  if (cron) return cron;
  throw new RoutineScheduleError();
}

export function createStoredRoutine(input: RoutineCreateInput): StoredRoutine {
  const { name, prompt, parsed } = prepareRoutineCreate(input);
  const now = Date.now();
  return {
    id: newId(),
    name,
    prompt,
    schedule: parsed.schedule,
    timezone: parsed.timezone,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeTimezone(raw?: string): string {
  const trimmed = (raw ?? "").trim() || DEFAULT_ROUTINE_TIMEZONE;
  if (trimmed.length > MAX_ROUTINE_TIMEZONE) throw new RoutineScheduleError();
  try {
    Intl.DateTimeFormat("en-US", { timeZone: trimmed });
  } catch {
    throw new RoutineScheduleError(`Unknown timezone “${trimmed}”.`);
  }
  return trimmed;
}

function tryParseWallClockSchedule(
  raw: string,
  timezone: string,
): ParsedRoutineSchedule | null {
  const schedule = raw.trim().replace(/\s+/g, " ").toLowerCase();
  const interval = /^every ([1-9]\d*) (minute|minutes|hour|hours)$/.exec(
    schedule,
  );
  if (interval) {
    const count = Number(interval[1]);
    const unit = interval[2];
    if (!unit) return null;
    if (count === 1 && unit.endsWith("s")) return null;
    if (count !== 1 && !unit.endsWith("s")) return null;
    return {
      kind: "interval",
      schedule: `every ${count} ${unit}`,
      timezone: DEFAULT_ROUTINE_TIMEZONE,
    };
  }
  const daily = new RegExp(`^every day at ${CLOCK_CAPTURE}$`).exec(schedule);
  if (daily) {
    const time = parseRoutineClock(daily[1]);
    if (!time) return null;
    return {
      kind: "wall-clock",
      schedule: `every day at ${time}`,
      timezone,
    };
  }
  const weekday = new RegExp(`^every weekday at ${CLOCK_CAPTURE}$`).exec(
    schedule,
  );
  if (weekday) {
    const time = parseRoutineClock(weekday[1]);
    if (!time) return null;
    return {
      kind: "wall-clock",
      schedule: `every weekday at ${time}`,
      timezone,
    };
  }
  const weekly = new RegExp(
    `^every week on ([a-z,\\s]+) at ${CLOCK_CAPTURE}$`,
  ).exec(schedule);
  if (weekly) {
    const rawDays = weekly[1];
    const time = parseRoutineClock(weekly[2]);
    if (!rawDays || !time) return null;
    const days = parseDayList(rawDays);
    if (!days) return null;
    return {
      kind: "wall-clock",
      schedule: `every week on ${days} at ${time}`,
      timezone,
    };
  }
  return null;
}

const CLOCK_CAPTURE = String.raw`(\d{1,2}(?::[0-5]\d)?(?:\s*[ap]m)?)`;

function tryParseCronSchedule(
  raw: string,
  timezone: string,
): ParsedRoutineSchedule | null {
  const parts = raw.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minute, hour, day, month, weekday] = parts;
  if (!minute || !hour || !weekday || day !== "*" || month !== "*") return null;

  const intervalMinutes = /^\*\/([1-9]\d*)$/.exec(minute ?? "");
  if (intervalMinutes && hour === "*" && weekday === "*") {
    const count = Number(intervalMinutes[1]);
    if (count === 1) {
      return {
        kind: "interval",
        schedule: "every 1 minute",
        timezone: DEFAULT_ROUTINE_TIMEZONE,
      };
    }
    return {
      kind: "interval",
      schedule: `every ${count} minutes`,
      timezone: DEFAULT_ROUTINE_TIMEZONE,
    };
  }
  const intervalHours = /^\*\/([1-9]\d*)$/.exec(hour ?? "");
  if (minute === "0" && intervalHours && weekday === "*") {
    const count = Number(intervalHours[1]);
    if (count === 1) {
      return {
        kind: "interval",
        schedule: "every 1 hour",
        timezone: DEFAULT_ROUTINE_TIMEZONE,
      };
    }
    return {
      kind: "interval",
      schedule: `every ${count} hours`,
      timezone: DEFAULT_ROUTINE_TIMEZONE,
    };
  }

  const time = cronTime(minute, hour);
  if (!time) return null;
  if (weekday === "*" || weekday === "0-6") {
    return {
      kind: "wall-clock",
      schedule: `every day at ${time}`,
      timezone,
    };
  }
  if (weekday === "1-5") {
    return {
      kind: "wall-clock",
      schedule: `every weekday at ${time}`,
      timezone,
    };
  }
  const days = cronWeekdays(weekday);
  if (!days) return null;
  return {
    kind: "wall-clock",
    schedule: `every week on ${days} at ${time}`,
    timezone,
  };
}

function cronTime(
  minute: string | undefined,
  hour: string | undefined,
): string | null {
  if (!minute || !hour) return null;
  if (!/^\d{1,2}$/.test(minute) || !/^\d{1,2}$/.test(hour)) return null;
  const mm = Number(minute);
  const hh = Number(hour);
  if (mm > 59 || hh > 23) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function cronWeekdays(field: string): string | null {
  const parts = field.split(",");
  const seen = new Set<number>();
  const days: string[] = [];
  for (const part of parts) {
    const named = DAY_INDEX[part.toLowerCase()];
    const index = named ?? (/^\d$/.test(part) ? Number(part) : Number.NaN);
    if (!Number.isInteger(index) || index < 0 || index > 6 || seen.has(index)) {
      return null;
    }
    seen.add(index);
    const name = DAY_NAMES[index];
    if (!name) return null;
    days.push(name);
  }
  return days.length > 0 ? days.join(",") : null;
}

function parseDayList(raw: string): string | null {
  const seen = new Set<number>();
  const days: string[] = [];
  for (const part of raw.split(",")) {
    const index = DAY_INDEX[part.trim().toLowerCase()];
    if (index == null || seen.has(index)) return null;
    seen.add(index);
    const name = DAY_NAMES[index];
    if (!name) return null;
    days.push(name);
  }
  return days.length > 0 ? days.join(",") : null;
}

function intervalToAgentWhen(schedule: string): AgentRoutineWhen {
  const match = /^every ([1-9]\d*) (minute|minutes|hour|hours)$/.exec(schedule);
  const count = Number(match?.[1]);
  const unit = match?.[2];
  if (!match || !Number.isFinite(count) || !unit) {
    throw new RoutineScheduleError();
  }
  if (unit.startsWith("minute")) {
    if (count === 1) return { kind: "cron", cron: "* * * * *" };
    if (count < 60 && 60 % count === 0) {
      return { kind: "cron", cron: `*/${count} * * * *` };
    }
    return { kind: "interval", intervalSeconds: count * 60 };
  }
  if (count === 1) return { kind: "cron", cron: "0 * * * *" };
  if (count < 24 && 24 % count === 0) {
    return { kind: "cron", cron: `0 */${count} * * *` };
  }
  return { kind: "interval", intervalSeconds: count * 3600 };
}

/** Agents cron is UTC. Shift a local wall-clock schedule into UTC fields. */
export function wallClockToUtcCron(
  schedule: string,
  timezone: string,
  at = new Date(),
): string {
  const daily = /^every day at (\d{2}):(\d{2})$/.exec(schedule);
  if (daily?.[1] && daily[2]) {
    return utcCronFromLocal(
      Number(daily[1]),
      Number(daily[2]),
      null,
      timezone,
      at,
    );
  }
  const weekday = /^every weekday at (\d{2}):(\d{2})$/.exec(schedule);
  if (weekday?.[1] && weekday[2]) {
    return utcCronFromLocal(
      Number(weekday[1]),
      Number(weekday[2]),
      [1, 2, 3, 4, 5],
      timezone,
      at,
    );
  }
  const weekly = /^every week on ([a-z,]+) at (\d{2}):(\d{2})$/.exec(schedule);
  const rawDays = weekly?.[1];
  const hour = weekly?.[2];
  const minute = weekly?.[3];
  if (!rawDays || !hour || !minute) throw new RoutineScheduleError();
  const days: number[] = [];
  for (const part of rawDays.split(",")) {
    const index = DAY_INDEX[part];
    if (index == null) throw new RoutineScheduleError();
    days.push(index);
  }
  return utcCronFromLocal(Number(hour), Number(minute), days, timezone, at);
}

function utcCronFromLocal(
  hour: number,
  minute: number,
  localWeekdays: number[] | null,
  timezone: string,
  at: Date,
): string {
  const zone = timezone.trim() || DEFAULT_ROUTINE_TIMEZONE;
  if (zone === DEFAULT_ROUTINE_TIMEZONE || zone === "Etc/UTC") {
    return cronFields(minute, hour, localWeekdays);
  }
  const targets = localWeekdays ?? [zonedWeekday(at, zone)];
  const shifted: Array<{ hour: number; minute: number; weekday: number }> = [];
  for (const weekday of targets) {
    const instant = zonedWallClockInstant(hour, minute, weekday, zone, at);
    const utcWeekday = instant.getUTCDay();
    shifted.push({
      hour: instant.getUTCHours(),
      minute: instant.getUTCMinutes(),
      weekday: utcWeekday,
    });
  }
  const time = shifted[0];
  if (!time) throw new RoutineScheduleError();
  if (
    shifted.some((row) => row.hour !== time.hour || row.minute !== time.minute)
  ) {
    throw new RoutineScheduleError();
  }
  const days = localWeekdays
    ? [...new Set(shifted.map((row) => row.weekday))].sort((a, b) => a - b)
    : null;
  return cronFields(time.minute, time.hour, days);
}

function cronFields(
  minute: number,
  hour: number,
  weekdays: number[] | null,
): string {
  if (!weekdays || weekdays.length === 0 || weekdays.length === 7) {
    return `${minute} ${hour} * * *`;
  }
  if (weekdays.join(",") === "1,2,3,4,5") {
    return `${minute} ${hour} * * 1-5`;
  }
  return `${minute} ${hour} * * ${weekdays.join(",")}`;
}

function zonedWallClockInstant(
  hour: number,
  minute: number,
  weekday: number,
  timeZone: string,
  at: Date,
): Date {
  const start = zonedCalendarDate(at, timeZone);
  for (let i = 0; i < 14; i++) {
    const day = addCalendarDays(start, i);
    const instant = zonedTimeToUtc(
      day.year,
      day.month,
      day.day,
      hour,
      minute,
      timeZone,
    );
    if (zonedWeekday(instant, timeZone) === weekday) return instant;
  }
  throw new RoutineScheduleError();
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = guess - tzOffsetMs(guess, timeZone);
  utc = guess - tzOffsetMs(utc, timeZone);
  return new Date(utc);
}

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const wall = zonedDateParts(new Date(utcMs), timeZone);
  const asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  return asUtc - utcMs;
}

function zonedCalendarDate(at: Date, timeZone: string) {
  const parts = zonedDateParts(at, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

function zonedWeekday(at: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(at);
  const index = DAY_INDEX[name.toLowerCase()];
  if (index == null) throw new RoutineScheduleError();
  return index;
}

function zonedDateParts(at: Date, timeZone: string) {
  const map: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function addCalendarDays(
  start: { year: number; month: number; day: number },
  days: number,
) {
  const next = new Date(Date.UTC(start.year, start.month - 1, start.day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export class MemoryRoutineStore {
  private readonly bots = new Map<string, StoredRoutine[]>();

  list(botId: string): StoredRoutine[] {
    return [...(this.bots.get(botId) ?? [])].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }

  create(botId: string, input: RoutineCreateInput): StoredRoutine {
    const row = createStoredRoutine(input);
    const rows = this.bots.get(botId) ?? [];
    rows.push(row);
    this.bots.set(botId, rows);
    return row;
  }

  setActive(botId: string, id: string, active: boolean): StoredRoutine {
    const row = this.require(botId, id);
    row.active = active;
    row.updatedAt = Date.now();
    return row;
  }

  remove(botId: string, id: string): void {
    this.require(botId, id);
    const rows = this.bots.get(botId) ?? [];
    this.bots.set(
      botId,
      rows.filter((row) => row.id !== id),
    );
  }

  private require(botId: string, id: string): StoredRoutine {
    const row = (this.bots.get(botId) ?? []).find((item) => item.id === id);
    if (!row) throw new RoutineNotFoundError();
    return row;
  }
}
