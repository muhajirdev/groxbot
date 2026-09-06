/** Canonical cloud hosts. Local dev still uses 127.0.0.1. */
export const CLOUD_LANDING_ORIGIN = "https://groxbot.com";
export const CLOUD_WEB_ORIGIN = "https://app.groxbot.com";
export const CLOUD_ADMIN_ORIGIN = "https://admin.groxbot.com";
export const CLOUD_API_ORIGIN = "https://api.groxbot.com";

/** Expo app scheme. Magic-link and OAuth callbacks land here on a device. */
export const CLOUD_APP_SCHEME = "groxbot";
export const CLOUD_APP_ORIGIN = `${CLOUD_APP_SCHEME}://`;

/** Staging on workers.dev until groxbot.com is attached. */
export const STAGING_LANDING_ORIGIN =
  "https://groxbot-landing.qalam.workers.dev";
export const STAGING_WEB_ORIGIN = "https://groxbot-web.qalam.workers.dev";
export const STAGING_ADMIN_ORIGIN = "https://groxbot-admin.qalam.workers.dev";
export const STAGING_API_ORIGIN = "https://groxbot-api.qalam.workers.dev";

const LOCAL_LANDING_ORIGIN = "http://127.0.0.1:5174";

export function groxbotCookieDomain(origin: string): string | undefined {
  try {
    const { hostname } = new URL(origin);
    if (hostname === "groxbot.com" || hostname.endsWith(".groxbot.com")) {
      return ".groxbot.com";
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function isGroxbotStagingOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === new URL(STAGING_LANDING_ORIGIN).hostname ||
      hostname === new URL(STAGING_WEB_ORIGIN).hostname ||
      hostname === new URL(STAGING_API_ORIGIN).hostname
    );
  } catch {
    return false;
  }
}

/** Marketing host that matches this office origin. */
export function landingOriginForWeb(webOrigin: string): string {
  const origin = webOrigin.replace(/\/$/, "");
  if (origin === CLOUD_WEB_ORIGIN) return CLOUD_LANDING_ORIGIN;
  if (origin === STAGING_WEB_ORIGIN) return STAGING_LANDING_ORIGIN;
  return LOCAL_LANDING_ORIGIN;
}

export function knowledgeSharePath(shareId: string): string {
  return `/s/${encodeURIComponent(shareId.trim())}`;
}

export function knowledgeShareUrl(
  landingOrigin: string,
  shareId: string,
): string {
  return `${landingOrigin.replace(/\/$/, "")}${knowledgeSharePath(shareId)}`;
}
