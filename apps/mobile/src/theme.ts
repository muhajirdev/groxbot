/** Same tokens as apps/web/src/styles.css :root (dark). */
export const colors = {
  bg: "#000000",
  surface: "#161616",
  surface2: "#2a2a2a",
  card: "#1c1c1c",
  line: "#333333",
  text: "#f4f4f4",
  muted: "#8a8a8a",
  faint: "#6b6b6b",
  accent: "#e45c9a",
  accentInk: "#ffffff",
  ok: "#3ecf8e",
  danger: "#e25d4a",
  white: "#fff",
};

export const space = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 36,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const type = {
  kicker: {
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "600" as const,
    letterSpacing: -0.6,
  },
  lede: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
};
