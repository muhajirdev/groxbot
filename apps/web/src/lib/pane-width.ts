import { useColumnWidth } from "./column-width";

export const PANE_WIDTH_MIN = 280;
export const PANE_WIDTH_MAX = 640;
export const PANE_WIDTH_DEFAULT = 380;

const PANE_WIDTH = {
  key: "groxbot.paneWidth",
  min: PANE_WIDTH_MIN,
  max: PANE_WIDTH_MAX,
  fallback: PANE_WIDTH_DEFAULT,
  invert: true,
} as const;

export function clampPaneWidth(value: number): number {
  if (!Number.isFinite(value)) return PANE_WIDTH_DEFAULT;
  return Math.min(PANE_WIDTH_MAX, Math.max(PANE_WIDTH_MIN, Math.round(value)));
}

export function usePaneWidth() {
  return useColumnWidth(PANE_WIDTH);
}
