import { isIntervalSchedule, parseRoutineClock } from "@groxbot/core/browser";
import { readTimezonePref } from "./prefs";

export const ROUTINE_WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type RoutineWeekday = (typeof ROUTINE_WEEKDAYS)[number];

export type RoutineScheduleKind =
  | "hour"
  | "day"
  | "weekday"
  | "week"
  | "interval"
  | "advanced";

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Jakarta",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export const ROUTINE_INTERVALS = [
  "every 15 minutes",
  "every 30 minutes",
  "every 1 hour",
  "every 2 hours",
  "every 6 hours",
] as const;

export const DEFAULT_ROUTINE_CLOCK = "09:00";

export function defaultRoutineTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function routineClockOptions(): string[] {
  const out: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      out.push(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      );
    }
  }
  return out;
}

export function formatRoutineClock(hhmm: string): string {
  const parsed = parseRoutineClock(hhmm.includes(":") ? hhmm : `${hhmm}:00`);
  if (!parsed) return hhmm;
  const hour = Number(parsed.slice(0, 2));
  const minute = parsed.slice(3);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${period}`;
}

export function composeRoutineSchedule(input: {
  kind: RoutineScheduleKind;
  time: string;
  weekday: string;
  interval: string;
  advanced: string;
}): string {
  const time = parseRoutineClock(input.time) ?? DEFAULT_ROUTINE_CLOCK;
  switch (input.kind) {
    case "hour":
      return "every 1 hour";
    case "day":
      return `every day at ${time}`;
    case "weekday":
      return `every weekday at ${time}`;
    case "week":
      return `every week on ${input.weekday} at ${time}`;
    case "interval":
      return input.interval;
    default:
      return input.advanced.trim();
  }
}

export function kindFromRoutineSchedule(cron: string): RoutineScheduleKind {
  if (cron === "every 1 hour") return "hour";
  if (cron.startsWith("every day at ")) return "day";
  if (cron.startsWith("every weekday at ")) return "weekday";
  if (cron.startsWith("every week on ")) return "week";
  if (isIntervalSchedule(cron)) return "interval";
  return "advanced";
}

export function formatRoutineScheduleLabel(cron: string): string {
  if (cron === "every 1 hour") return "Every hour";
  const interval = /^every ([1-9]\d*) (minute|minutes|hour|hours)$/.exec(cron);
  if (interval?.[1] && interval[2]) {
    return `Every ${interval[1]} ${interval[2]}`;
  }
  const daily = /^every day at (\d{2}:\d{2})$/.exec(cron);
  if (daily?.[1]) return `Every day at ${formatRoutineClock(daily[1])}`;
  const weekday = /^every weekday at (\d{2}:\d{2})$/.exec(cron);
  if (weekday?.[1]) return `Weekdays at ${formatRoutineClock(weekday[1])}`;
  const weekly = /^every week on ([a-z,]+) at (\d{2}:\d{2})$/.exec(cron);
  if (weekly?.[1] && weekly[2]) {
    const days = weekly[1]
      .split(",")
      .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
      .join(", ");
    return `Every ${days} at ${formatRoutineClock(weekly[2])}`;
  }
  return cron;
}

export function formatRoutineWhen(cron: string, timezone: string): string {
  const label = formatRoutineScheduleLabel(cron);
  if (isIntervalSchedule(cron) || !timezone) return label;
  return `${label} · ${timezone.replaceAll("_", " ")}`;
}

export function resolveRoutineTimezone(
  pref: string,
  detected = defaultRoutineTimezone(),
): string {
  const next = !pref.trim() || pref === "auto" ? detected : pref.trim();
  try {
    Intl.DateTimeFormat("en-US", { timeZone: next });
    return next;
  } catch {
    return detected;
  }
}

export function officeTimezone(): string {
  return resolveRoutineTimezone(readTimezonePref());
}

export function listRoutineTimezones(): string[] {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    // Use the short list.
  }
  return FALLBACK_TIMEZONES;
}

export function formatRoutineTimezone(tz: string, at = new Date()): string {
  const name = tz.replaceAll("_", " ");
  let offset = "";
  try {
    offset =
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "shortOffset",
      })
        .formatToParts(at)
        .find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    offset = "";
  }
  return offset ? `${name} (${offset})` : name;
}
