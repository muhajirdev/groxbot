/** Pixel Planga seated roster faces. One JPG per teammate, picked from a stable seed. */

export const CLAY_AVATAR_COUNT = 20;

export function clayAvatarSrc(seed: string): string {
  const n = clayAvatarIndex(seed);
  const file = String(n + 1).padStart(2, "0");
  return `/clay/pixel-planga-seated-${file}.jpg`;
}

export function clayAvatarIndex(seed: string): number {
  const key = seed.trim() || "bot";
  let n = 0;
  for (const ch of key) n = (n * 33 + ch.charCodeAt(0)) | 0;
  return Math.abs(n) % CLAY_AVATAR_COUNT;
}
