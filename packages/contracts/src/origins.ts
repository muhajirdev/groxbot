/** Canonical cloud hosts. Local dev still uses 127.0.0.1. */
export const CLOUD_ROOT_HOST = "whip.computer";
export const CLOUD_LANDING_ORIGIN = `https://${CLOUD_ROOT_HOST}`;
export const CLOUD_WWW_ORIGIN = `https://www.${CLOUD_ROOT_HOST}`;
export const CLOUD_WEB_ORIGIN = `https://app.${CLOUD_ROOT_HOST}`;
export const CLOUD_ADMIN_ORIGIN = `https://admin.${CLOUD_ROOT_HOST}`;
export const CLOUD_API_ORIGIN = `https://api.${CLOUD_ROOT_HOST}`;

/** Previous public hosts. Still accepted for CORS, cookies, and redirects. */
export const LEGACY_ROOT_HOST = "groxbot.com";
export const LEGACY_LANDING_ORIGIN = `https://${LEGACY_ROOT_HOST}`;
export const LEGACY_WWW_ORIGIN = `https://www.${LEGACY_ROOT_HOST}`;
export const LEGACY_WEB_ORIGIN = `https://app.${LEGACY_ROOT_HOST}`;
export const LEGACY_ADMIN_ORIGIN = `https://admin.${LEGACY_ROOT_HOST}`;
export const LEGACY_API_ORIGIN = `https://api.${LEGACY_ROOT_HOST}`;

/** Expo app scheme. Magic-link and OAuth callbacks land here on a device. */
export const CLOUD_APP_SCHEME = "groxbot";
export const CLOUD_APP_ORIGIN = `${CLOUD_APP_SCHEME}://`;
/** Expo Go (`npx expo start`). `Linking.createURL` uses this instead of groxbot://. */
export const EXPO_GO_ORIGIN = "exp://";
/** Expo Dev Client. Same callback path as a packaged app, different scheme. */
export const EXPO_DEV_CLIENT_ORIGIN = `exp+${CLOUD_APP_SCHEME}://`;
/** Native Swift companion. Magic-link callbacks land here, not on Expo. */
export const CLOUD_IOS_APP_SCHEME = "groxbot-ios";
export const CLOUD_IOS_APP_ORIGIN = `${CLOUD_IOS_APP_SCHEME}://`;

/** Staging on workers.dev until custom domains are attached. */
export const STAGING_LANDING_ORIGIN =
  "https://groxbot-landing.qalam.workers.dev";
export const STAGING_WEB_ORIGIN = "https://groxbot-web.qalam.workers.dev";
export const STAGING_ADMIN_ORIGIN = "https://groxbot-admin.qalam.workers.dev";
export const STAGING_API_ORIGIN = "https://groxbot-api.qalam.workers.dev";

const LOCAL_LANDING_ORIGIN = "http://127.0.0.1:5174";

function hostInFamily(hostname: string, root: string): boolean {
  return hostname === root || hostname.endsWith(`.${root}`);
}

export function groxbotCookieDomain(origin: string): string | undefined {
  try {
    const { hostname } = new URL(origin);
    if (hostInFamily(hostname, CLOUD_ROOT_HOST)) return `.${CLOUD_ROOT_HOST}`;
    if (hostInFamily(hostname, LEGACY_ROOT_HOST)) return `.${LEGACY_ROOT_HOST}`;
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
  if (origin === LEGACY_WEB_ORIGIN) return LEGACY_LANDING_ORIGIN;
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
