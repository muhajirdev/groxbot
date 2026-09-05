import { CLOUD_API_ORIGIN, landingOriginForWeb } from "@groxbot/contracts";

const LOCAL_API_ORIGIN = "http://127.0.0.1:3100";
const LOCAL_WEB_ORIGIN = "http://127.0.0.1:5173";

/** Absolute origin for oRPC, auth, and office Cap’n Web. Local dev talks to wrangler, not the Vite proxy. */
export function apiOrigin(): string {
  const explicit = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (import.meta.env.PROD) return CLOUD_API_ORIGIN;
  return LOCAL_API_ORIGIN;
}

/** Host for the API origin (no scheme). */
export function agentSocketHost(): string {
  try {
    return new URL(apiOrigin()).host;
  } catch {
    return "127.0.0.1:3100";
  }
}

/** Vite / office origin. Auth callbacks must land here, not on the API. */
export function officeOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return LOCAL_WEB_ORIGIN;
}

export function officeUrl(path: string): string {
  return new URL(path, `${officeOrigin()}/`).href;
}

/** Marketing host that serves unlisted knowledge shares. */
export function landingOrigin(): string {
  const explicit = import.meta.env.VITE_LANDING_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  return landingOriginForWeb(officeOrigin());
}
