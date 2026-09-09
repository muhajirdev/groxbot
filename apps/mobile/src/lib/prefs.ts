const memory = new Map<string, string>();

export function readPref(key: string): string | null {
  return memory.get(key) ?? null;
}

export function writePref(key: string, value: string): void {
  memory.set(key, value);
}

export function clearPref(key: string): void {
  memory.delete(key);
}

export const AUTO_TIMEZONE = "auto";

export function defaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function readTimezonePref(): string {
  return readPref("groxbot.timezone")?.trim() || AUTO_TIMEZONE;
}

export function writeTimezonePref(value: string): void {
  writePref("groxbot.timezone", value.trim() || AUTO_TIMEZONE);
}

export function officeTimezone(): string {
  const pref = readTimezonePref();
  return pref === AUTO_TIMEZONE ? defaultTimezone() : pref;
}
