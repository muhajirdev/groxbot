import { CLOUD_API_ORIGIN, CLOUD_WEB_ORIGIN } from "@groxbot/contracts";

const LOCAL_WEB_ORIGIN = "http://127.0.0.1:5173";
const LOCAL_API_ORIGIN = "http://127.0.0.1:3100";

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

/** Same-site hash on the marketing host. Inner pages jump home to the form. */
export function appAccessUrl(): string {
  return "/#access";
}

export function resolveApiOrigin(env: {
  viteApiUrl?: string;
  prod: boolean;
}): string {
  const explicit = env.viteApiUrl?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (env.prod) return CLOUD_API_ORIGIN;
  return LOCAL_API_ORIGIN;
}

export function landingApiOrigin(): string {
  return resolveApiOrigin({
    viteApiUrl: import.meta.env.VITE_API_URL,
    prod: import.meta.env.PROD,
  });
}

export function accessRequestUrl(): string {
  return `${landingApiOrigin()}/api/access/request`;
}
