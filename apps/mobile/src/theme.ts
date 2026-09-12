import { DefaultTheme, type Theme } from "@react-navigation/native";
import { Platform } from "react-native";

export function isIos26(): boolean {
  if (Platform.OS !== "ios") return false;
  const raw = Platform.Version;
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
  return Number.isFinite(n) && n >= 26;
}

/** Light office. Pink accent stays the brand mark. */
export const colors = {
  bg: "#ffffff",
  surface: "#f2f2f7",
  surface2: "#e5e5ea",
  card: "#f7f7f8",
  line: "#e5e5ea",
  text: "#111111",
  muted: "#6e6e73",
  faint: "#8e8e93",
  accent: "#e45c9a",
  accentInk: "#ffffff",
  ok: "#1f8a54",
  danger: "#d70015",
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

export const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.line,
    notification: colors.accent,
  },
};

/**
 * One white canvas. No system material plate — that reads as a second color.
 * Delight lives in the title, pink tint, and prominent header items.
 */
export const glassHeader = {
  headerTransparent: false,
  headerShadowVisible: false,
  headerLargeTitleShadowVisible: false,
  headerStyle: {
    backgroundColor: colors.bg,
  },
  headerLargeStyle: {
    backgroundColor: colors.bg,
  },
  headerTintColor: colors.accent,
  headerTitleStyle: {
    fontWeight: "600" as const,
    color: colors.text,
  },
};
