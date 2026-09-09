export const OFFICE_COLOR_KEY = "groxbot.officeColor";

export const OFFICE_COLORS = [
  { id: "snow", label: "Light", blurb: "Soft chrome, warm white desk", swatch: "#fffefa", rail: "#f2f1ed", theme: "light" },
  { id: "linear", label: "Dark", blurb: "Charcoal, quiet chrome", swatch: "#131315", rail: "#0d0d0e", theme: "dark" },
  { id: "night", label: "Night", blurb: "Navy desk", swatch: "#0c152c", rail: "#060a18", theme: "dark" },
  { id: "paper", label: "Paper", blurb: "Kraft and cream", swatch: "#f7f0e4", rail: "#d4c4ae", theme: "light" },
  { id: "blush", label: "Blush", blurb: "Rose", swatch: "#f3c2d2", rail: "#e89ab4", theme: "light" },
] as const;

export type OfficeColorId = (typeof OFFICE_COLORS)[number]["id"];

export const DEFAULT_OFFICE_COLOR: OfficeColorId = "linear";
export const LIGHT_OFFICE_COLOR: OfficeColorId = "snow";
export const DARK_OFFICE_COLOR: OfficeColorId = "linear";

const BY_ID = Object.fromEntries(
  OFFICE_COLORS.map((color) => [color.id, color]),
) as Record<OfficeColorId, (typeof OFFICE_COLORS)[number]>;

const LEGACY: Record<string, OfficeColorId> = {
  dusk: "linear",
  clay: "linear",
  charcoal: "linear",
  umber: "night",
  moss: "night",
  teal: "night",
  panic: "night",
  nord: "night",
  graphite: "snow",
  dust: "paper",
  bone: "paper",
  sage: "paper",
  mist: "paper",
};

export function isOfficeColorId(
  value: string | null | undefined,
): value is OfficeColorId {
  return Boolean(value && value in BY_ID);
}

export function readOfficeColor(): OfficeColorId {
  try {
    const value = localStorage.getItem(OFFICE_COLOR_KEY);
    const theme = localStorage.getItem("groxbot.theme");
    const light =
      theme === "light" ||
      (theme === "system" &&
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: light)").matches);
    if (isOfficeColorId(value)) return value;
    const mapped = value ? LEGACY[value] : undefined;
    if (mapped) {
      if (BY_ID[mapped].theme === "dark" && light) return "snow";
      return mapped;
    }
    if (light) return "snow";
  } catch {
    // Node / locked storage.
  }
  return DEFAULT_OFFICE_COLOR;
}

export function officeColorForAppearance(
  appearance: "light" | "dark",
  current: OfficeColorId,
): OfficeColorId {
  if (BY_ID[current].theme === appearance) return current;
  return appearance === "light" ? LIGHT_OFFICE_COLOR : DARK_OFFICE_COLOR;
}

export function applyOfficeColor(
  id: OfficeColorId,
  opts?: { theme?: "system" | "light" | "dark" },
): void {
  const spec = BY_ID[id];
  try {
    localStorage.setItem(OFFICE_COLOR_KEY, id);
    localStorage.setItem("groxbot.theme", opts?.theme ?? spec.theme);
  } catch {
    // Ignore quota / private mode.
  }
  if (typeof document !== "undefined") {
    document.documentElement.dataset.officeColor = id;
    document.documentElement.dataset.theme = spec.theme;
  }
}
