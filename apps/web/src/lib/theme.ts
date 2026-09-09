import {
  applyOfficeColor,
  officeColorForAppearance,
  readOfficeColor,
  type OfficeColorId,
} from "./office-color";

export type Theme = "system" | "light" | "dark";
export type Appearance = "light" | "dark";

export const THEME_KEY = "groxbot.theme";

export function readTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    // Node / locked storage.
  }
  return "dark";
}

export function resolvedAppearance(theme: Theme): Appearance {
  if (theme === "light") return "light";
  if (theme === "dark") return "dark";
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme): OfficeColorId {
  const appearance = resolvedAppearance(theme);
  const color = officeColorForAppearance(appearance, readOfficeColor());
  applyOfficeColor(color, { theme });
  return color;
}

/** Boot: honor an explicit theme, otherwise the stored look. */
export function syncChrome(): OfficeColorId {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "system" || stored === "light" || stored === "dark") {
      return applyTheme(stored);
    }
  } catch {
    // Node / locked storage.
  }
  const color = readOfficeColor();
  applyOfficeColor(color);
  return color;
}

export function watchSystemTheme(): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (readTheme() === "system") applyTheme("system");
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
