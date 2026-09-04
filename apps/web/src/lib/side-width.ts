import { useColumnWidth } from "./column-width";

export const SIDE_WIDTH_MIN = 180;
export const SIDE_WIDTH_MAX = 420;
export const SIDE_WIDTH_DEFAULT = 240;
export const SIDE_WIDTH_STEP = 8;

const SIDE_WIDTH = {
  key: "groxbot.sideWidth",
  min: SIDE_WIDTH_MIN,
  max: SIDE_WIDTH_MAX,
  fallback: SIDE_WIDTH_DEFAULT,
} as const;

export function clampSideWidth(value: number): number {
  if (!Number.isFinite(value)) return SIDE_WIDTH_DEFAULT;
  return Math.min(SIDE_WIDTH_MAX, Math.max(SIDE_WIDTH_MIN, Math.round(value)));
}

export function readSideWidth(): number {
  try {
    const raw = localStorage.getItem(SIDE_WIDTH.key);
    if (!raw) return SIDE_WIDTH_DEFAULT;
    return clampSideWidth(Number(raw));
  } catch {
    return SIDE_WIDTH_DEFAULT;
  }
}

export function writeSideWidth(value: number): void {
  localStorage.setItem(SIDE_WIDTH.key, String(clampSideWidth(value)));
}

export function useSideWidth() {
  return useColumnWidth(SIDE_WIDTH);
}
