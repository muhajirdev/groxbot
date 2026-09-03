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

export function invitationIdFromInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return inviteFromHref(trimmed) ?? trimmed;
}

let rememberedInvite = "";

export function rememberInvite(id: string): void {
  rememberedInvite = id.trim();
}

export function readRememberedInvite(): string {
  return rememberedInvite;
}

export function clearRememberedInvite(): void {
  rememberedInvite = "";
}
