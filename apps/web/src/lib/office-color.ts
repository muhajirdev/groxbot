export const OFFICE_COLOR_KEY = "groxbot.officeColor";

export const OFFICE_COLORS = [
  { id: "linear", label: "Linear", swatch: "#0f1011", theme: "dark" },
  { id: "night", label: "Night", swatch: "#0c152c", theme: "dark" },
  { id: "snow", label: "Snow", swatch: "#ffffff", theme: "light" },
  { id: "paper", label: "Paper", swatch: "#f7f0e4", theme: "light" },
  { id: "blush", label: "Blush", swatch: "#f3c2d2", theme: "light" },
] as const;

export type OfficeColorId = (typeof OFFICE_COLORS)[number]["id"];

export const DEFAULT_OFFICE_COLOR: OfficeColorId = "linear";

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

export function applyOfficeColor(id: OfficeColorId): void {
  const spec = BY_ID[id];
  try {
    localStorage.setItem(OFFICE_COLOR_KEY, id);
    localStorage.setItem("groxbot.theme", spec.theme);
  } catch {
    // Ignore quota / private mode.
  }
  if (typeof document !== "undefined") {
    document.documentElement.dataset.officeColor = id;
    document.documentElement.dataset.theme = spec.theme;
  }
}
