export type Theme = "system" | "light" | "dark";
export type Appearance = "light" | "dark";

const KEY = "groxbot.theme";

export function readTheme(): Theme {
  const value = localStorage.getItem(KEY);
  if (value === "light" || value === "dark" || value === "system") return value;
  return "dark";
}

export function resolvedAppearance(theme: Theme): "light" | "dark" {
  if (theme === "light") return "light";
  if (theme === "dark") return "dark";
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme): void {
  localStorage.setItem(KEY, theme);
  document.documentElement.dataset.theme = resolvedAppearance(theme);
}
