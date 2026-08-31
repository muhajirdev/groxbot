const INVITE_KEY = "groxbot.invite";

/** Pull `?invite=` from a full URL or a router path like `/onboarding?invite=`. */
export function inviteFromHref(href: string): string | undefined {
  const trimmed = href.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed, "https://groxbot.local");
    const invite = url.searchParams.get("invite")?.trim();
    return invite || undefined;
  } catch {
    const match = trimmed.match(/[?&]invite=([^&]+)/);
    if (!match?.[1]) return undefined;
    try {
      return decodeURIComponent(match[1]).trim() || undefined;
    } catch {
      return match[1].trim() || undefined;
    }
  }
}

export function rememberInvite(id: string | undefined) {
  if (typeof window === "undefined") return;
  const trimmed = id?.trim();
  if (trimmed) sessionStorage.setItem(INVITE_KEY, trimmed);
}

export function readRememberedInvite(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(INVITE_KEY)?.trim() ?? "";
}

export function clearRememberedInvite() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(INVITE_KEY);
}
