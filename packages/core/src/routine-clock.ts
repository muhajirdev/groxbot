/** Browser-safe clock helpers. Do not import the main `@groxbot/core` barrel from the SPA. */

export function isIntervalSchedule(schedule: string): boolean {
  return /^every [1-9]\d* (minute|minutes|hour|hours)$/.test(
    schedule.trim().replace(/\s+/g, " ").toLowerCase(),
  );
}

/** `09:00`, `9:00 AM`, `9am`, `12:30 pm`. Returns padded 24h `HH:mm`. */
export function parseRoutineClock(raw: string | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim().replace(/\s+/g, " ").toLowerCase();
  const ampm = /^(\d{1,2})(?::([0-5]\d))?\s*(am|pm)$/.exec(text);
  if (ampm?.[1] && ampm[3]) {
    let hour = Number(ampm[1]);
    const minute = ampm[2] ?? "00";
    if (hour < 1 || hour > 12) return null;
    if (ampm[3] === "am") hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }
  const match = /^(\d{1,2})(?::([0-5]\d))?$/.exec(text);
  if (!match?.[1]) return null;
  const hour = Number(match[1]);
  const minute = match[2] ?? "00";
  if (hour > 23) return null;
  if (!match[2] && hour <= 12) return null;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}
