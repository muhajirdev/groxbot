export type LocalComputerPref = "ask" | "always" | "never";

const notifyKey = (botId: string) => `groxbot.notify.${botId}`;

export function readNotify(botId: string): boolean {
  return localStorage.getItem(notifyKey(botId)) === "1";
}

export function writeNotify(botId: string, value: boolean): void {
  localStorage.setItem(notifyKey(botId), value ? "1" : "0");
}

export function readLocalComputer(): LocalComputerPref {
  const value = localStorage.getItem("groxbot.localComputer");
  if (value === "ask" || value === "always" || value === "never") return value;
  return "ask";
}

export function writeLocalComputer(value: LocalComputerPref): void {
  localStorage.setItem("groxbot.localComputer", value);
}

export function readAutoReview(): boolean {
  return localStorage.getItem("groxbot.autoReview") === "1";
}

export function writeAutoReview(value: boolean): void {
  localStorage.setItem("groxbot.autoReview", value ? "1" : "0");
}

export function readHardwareAccel(): boolean {
  return localStorage.getItem("groxbot.hwAccel") !== "0";
}

export function writeHardwareAccel(value: boolean): void {
  localStorage.setItem("groxbot.hwAccel", value ? "1" : "0");
}

export function readAutoReviewRules(): string {
  return localStorage.getItem("groxbot.autoReviewRules") ?? "";
}

export function writeAutoReviewRules(value: string): void {
  localStorage.setItem("groxbot.autoReviewRules", value);
}

const collapsedSectionsKey = (workspaceId: string) =>
  `groxbot.sections.collapsed.${workspaceId}`;

export function readCollapsedSections(workspaceId: string): string[] {
  try {
    const raw = localStorage.getItem(collapsedSectionsKey(workspaceId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function writeCollapsedSections(
  workspaceId: string,
  ids: readonly string[],
): void {
  localStorage.setItem(
    collapsedSectionsKey(workspaceId),
    JSON.stringify([...ids]),
  );
}
