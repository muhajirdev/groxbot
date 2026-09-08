import { CLOUD_WEB_ORIGIN } from "@groxbot/contracts";
import { INVITE_MAILTO } from "./copy";

const LOCAL_WEB_ORIGIN = "http://127.0.0.1:5173";

export function resolveAppOrigin(env: {
  viteAppUrl?: string;
  prod: boolean;
}): string {
  const explicit = env.viteAppUrl?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (env.prod) return CLOUD_WEB_ORIGIN;
  return LOCAL_WEB_ORIGIN;
}

export function appOrigin(): string {
  return resolveAppOrigin({
    viteAppUrl: import.meta.env.VITE_APP_URL,
    prod: import.meta.env.PROD,
  });
}

export function appLoginUrl(): string {
  return `${appOrigin()}/login`;
}

/** Hosted office is invite-only — primary CTAs email for access. */
export function startUrl(): string {
  return INVITE_MAILTO;
}
