/** Drop the file at `apps/web/public/onboarding.mp4`. */
export const ONBOARDING_VIDEO_SRC = "/onboarding.mp4";

export const FOUNDER_NAME = "Muhajir";
export const FOUNDER_EMAIL = "muhammad@muhajir.dev";
export const FOUNDER_IMAGE = "https://github.com/muhajirdev.png";

export function defaultWorkspaceName(me?: {
  name?: string | null;
  email?: string | null;
} | null): string {
  const name = me?.name?.trim() || "";
  const email = me?.email?.trim() || "";
  if (name && name !== email && !name.includes("@")) return name;
  return "Workspace";
}

/** First name for the founder letter. Never the login email. */
export function onboardingFirstName(me?: {
  name?: string | null;
  email?: string | null;
} | null): string | null {
  const name = me?.name?.trim() || "";
  const email = me?.email?.trim() || "";
  if (!name || name === email || name.includes("@")) return null;
  return name.split(/\s+/)[0] ?? null;
}

/** Empty office — no live teammate yet. Reload shows the founder letter again. */
export function workspaceNeedsOnboarding(
  bots: readonly { archivedAt?: string | null }[],
): boolean {
  return !bots.some((bot) => !bot.archivedAt);
}
