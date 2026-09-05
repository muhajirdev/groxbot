import {
  CLOUD_ADMIN_ORIGIN,
  CLOUD_API_ORIGIN,
  CLOUD_APP_ORIGIN,
  CLOUD_LANDING_ORIGIN,
  CLOUD_WEB_ORIGIN,
  DURABLE_OBJECT_WAKEUP,
  GROX_GATEWAY_SECRET_ENV,
  GROX_GATEWAY_URL_ENV,
  HOSTED_AI_ENV,
  HOSTED_AI_FLAG,
  HTTP_WAKEUP,
  hostedCloudflareGateway,
  IN_PROCESS_WAKEUP,
  landingOriginForWeb,
  STAGING_ADMIN_ORIGIN,
  STAGING_API_ORIGIN,
  STAGING_LANDING_ORIGIN,
  STAGING_WEB_ORIGIN,
  type WakeupKind,
} from "@groxbot/contracts";
import { parseTinyfishKeys } from "@groxbot/core";

export { DURABLE_OBJECT_WAKEUP, HTTP_WAKEUP, IN_PROCESS_WAKEUP };

export type OAuthProviderId = "google" | "github";

export interface Env {
  databaseUrl: string;
  authSecret: string;
  authUrl: string;
  webOrigin: string;
  landingOrigin: string;
  corsOrigins: string[];
  workerUrl?: string;
  apiUrl?: string;
  guestUrl?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  githubClientId?: string;
  githubClientSecret?: string;
  cloudflareAccountId?: string;
  cloudflareAiGatewayToken?: string;
  cloudflareAiGatewayId?: string;
  hostedAiBinding?: boolean;
  groxGatewayUrl?: string;
  groxGatewaySecret?: string;
  emailBinding?: boolean;
  emailFrom?: string;
  encryptionKey?: string;
  composioApiKey?: string;
  tinyfishApiKey?: string;
  tinyfishApiKeys: string[];
  production: boolean;
  wakeupKind: WakeupKind;
  polarAccessToken?: string;
  polarWebhookSecret?: string;
  polarEnvironment: "sandbox" | "production";
}

function pair(
  id: string | undefined,
  secret: string | undefined,
): { clientId: string; clientSecret: string } | undefined {
  const clientId = id?.trim();
  const clientSecret = secret?.trim();
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret };
}

type OAuthEnv = Pick<
  Env,
  | "googleClientId"
  | "googleClientSecret"
  | "githubClientId"
  | "githubClientSecret"
>;

export function oauthCredentials(env: OAuthEnv) {
  return {
    google: pair(env.googleClientId, env.googleClientSecret),
    github: pair(env.githubClientId, env.githubClientSecret),
  };
}

export function oauthProviders(env: OAuthEnv): OAuthProviderId[] {
  const creds = oauthCredentials(env);
  const list: OAuthProviderId[] = [];
  if (creds.google) list.push("google");
  if (creds.github) list.push("github");
  return list;
}

function parseOrigins(value: string | undefined, fallback: string[]): string[] {
  const extra =
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? [];
  return [...new Set([...fallback, ...extra])];
}

/** String bindings / test bags. Worker objects (AI, EMAIL, DOs) are not included. */
export type EnvStrings = {
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  NODE_ENV?: string;
  WEB_ORIGIN?: string;
  LANDING_ORIGIN?: string;
  BETTER_AUTH_URL?: string;
  CORS_ORIGINS?: string;
  WORKER_URL?: string;
  API_URL?: string;
  GUEST_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_AI_GATEWAY_TOKEN?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_AI_GATEWAY_ID?: string;
  EMAIL_FROM?: string;
  ENCRYPTION_KEY?: string;
  COMPOSIO_API_KEY?: string;
  TINYFISH_API_KEY?: string;
  TINYFISH_API_KEYS?: string;
  WAKEUP_KIND?: string;
  POLAR_ACCESS_TOKEN?: string;
  POLAR_WEBHOOK_SECRET?: string;
  POLAR_ENVIRONMENT?: string;
  GROX_GATEWAY_URL?: string;
  GROX_GATEWAY_SECRET?: string;
};

/** BYOK / hosted gateway keys. Same names as wrangler vars, not Node process.env. */
export type RuntimeSource = Record<string, string | undefined>;

function read(source: EnvStrings, key: keyof EnvStrings): string | undefined {
  const value = source[key];
  return typeof value === "string" ? value : undefined;
}

export function loadEnv(source: EnvStrings): Env {
  const databaseUrl = read(source, "DATABASE_URL");
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const authSecret = read(source, "BETTER_AUTH_SECRET") ?? "";
  if (authSecret.length < 32 && read(source, "NODE_ENV") === "production") {
    throw new Error(
      "BETTER_AUTH_SECRET must be at least 32 characters in production",
    );
  }
  const webOrigin = read(source, "WEB_ORIGIN") ?? "http://127.0.0.1:5173";
  const landingOrigin =
    read(source, "LANDING_ORIGIN")?.replace(/\/$/, "") ||
    landingOriginForWeb(webOrigin);
  const tinyfishApiKeys = parseTinyfishKeys({
    TINYFISH_API_KEY: read(source, "TINYFISH_API_KEY"),
    TINYFISH_API_KEYS: read(source, "TINYFISH_API_KEYS"),
  });
  return {
    databaseUrl,
    authSecret: authSecret || "development-only-change-me-please-32ch",
    authUrl: read(source, "BETTER_AUTH_URL") ?? "http://127.0.0.1:3100",
    webOrigin,
    landingOrigin,
    corsOrigins: parseOrigins(read(source, "CORS_ORIGINS"), [
      webOrigin,
      landingOrigin,
      CLOUD_LANDING_ORIGIN,
      CLOUD_WEB_ORIGIN,
      CLOUD_ADMIN_ORIGIN,
      CLOUD_API_ORIGIN,
      STAGING_WEB_ORIGIN,
      STAGING_ADMIN_ORIGIN,
      STAGING_LANDING_ORIGIN,
      STAGING_API_ORIGIN,
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://127.0.0.1:5174",
      "http://localhost:5174",
      "http://127.0.0.1:5177",
      "http://localhost:5177",
      "http://127.0.0.1:8081",
      "http://localhost:8081",
      CLOUD_APP_ORIGIN,
    ]),
    workerUrl: read(source, "WORKER_URL"),
    apiUrl: read(source, "API_URL") ?? "http://127.0.0.1:3100",
    guestUrl: read(source, "GUEST_URL"),
    googleClientId: read(source, "GOOGLE_CLIENT_ID"),
    googleClientSecret: read(source, "GOOGLE_CLIENT_SECRET"),
    githubClientId: read(source, "GITHUB_CLIENT_ID"),
    githubClientSecret: read(source, "GITHUB_CLIENT_SECRET"),
    cloudflareAccountId: read(source, "CLOUDFLARE_ACCOUNT_ID"),
    cloudflareAiGatewayToken:
      read(source, "CLOUDFLARE_AI_GATEWAY_TOKEN")?.trim() ||
      read(source, "CLOUDFLARE_API_TOKEN")?.trim() ||
      undefined,
    cloudflareAiGatewayId:
      read(source, "CLOUDFLARE_AI_GATEWAY_ID")?.trim() || undefined,
    groxGatewayUrl: read(source, "GROX_GATEWAY_URL")?.trim() || undefined,
    groxGatewaySecret: read(source, "GROX_GATEWAY_SECRET")?.trim() || undefined,
    emailFrom: read(source, "EMAIL_FROM"),
    encryptionKey: read(source, "ENCRYPTION_KEY"),
    composioApiKey: read(source, "COMPOSIO_API_KEY")?.trim() || undefined,
    tinyfishApiKeys,
    tinyfishApiKey: tinyfishApiKeys[0],
    production: read(source, "NODE_ENV") === "production",
    wakeupKind:
      read(source, "WAKEUP_KIND") === DURABLE_OBJECT_WAKEUP
        ? DURABLE_OBJECT_WAKEUP
        : read(source, "WORKER_URL")
          ? HTTP_WAKEUP
          : IN_PROCESS_WAKEUP,
    polarAccessToken: read(source, "POLAR_ACCESS_TOKEN")?.trim() || undefined,
    polarWebhookSecret:
      read(source, "POLAR_WEBHOOK_SECRET")?.trim() || undefined,
    polarEnvironment:
      read(source, "POLAR_ENVIRONMENT")?.trim().toLowerCase() === "production"
        ? "production"
        : "sandbox",
  };
}

/** Worker / RoomActor: bindings in, product Env out. Wakeup is always the DO. */
export function productEnv(
  env: EnvStrings & { EMAIL?: unknown; AI?: unknown },
): Env {
  const loaded = loadEnv(env);
  loaded.emailBinding = Boolean(env.EMAIL);
  loaded.hostedAiBinding = Boolean(env.AI);
  loaded.wakeupKind = DURABLE_OBJECT_WAKEUP;
  return loaded;
}

/** Overlay for resolveRunModel / AI gateway. Hosted CF gateway + encryption. */
export function agentRuntimeSource(env: Env): RuntimeSource {
  if (env.groxGatewayUrl && env.groxGatewaySecret) {
    return {
      WEB_ORIGIN: env.webOrigin,
      ENCRYPTION_KEY: env.encryptionKey,
      BETTER_AUTH_SECRET: env.authSecret,
      NODE_ENV: env.production ? "production" : "development",
      POLAR_ACCESS_TOKEN: env.polarAccessToken,
      [GROX_GATEWAY_URL_ENV]: env.groxGatewayUrl,
      [GROX_GATEWAY_SECRET_ENV]: env.groxGatewaySecret,
    };
  }
  const hosted = env.hostedAiBinding
    ? hostedCloudflareGateway({
        [HOSTED_AI_ENV]: HOSTED_AI_FLAG,
        CLOUDFLARE_AI_GATEWAY_ID: env.cloudflareAiGatewayId,
      })
    : hostedCloudflareGateway({
        CLOUDFLARE_ACCOUNT_ID: env.cloudflareAccountId,
        CLOUDFLARE_AI_GATEWAY_TOKEN: env.cloudflareAiGatewayToken,
        CLOUDFLARE_API_TOKEN: env.cloudflareAiGatewayToken,
        CLOUDFLARE_AI_GATEWAY_ID: env.cloudflareAiGatewayId,
      });
  return {
    WEB_ORIGIN: env.webOrigin,
    ENCRYPTION_KEY: env.encryptionKey,
    BETTER_AUTH_SECRET: env.authSecret,
    NODE_ENV: env.production ? "production" : "development",
    POLAR_ACCESS_TOKEN: env.polarAccessToken,
    ...(hosted?.kind === "binding"
      ? {
          [HOSTED_AI_ENV]: HOSTED_AI_FLAG,
          CLOUDFLARE_AI_GATEWAY_ID: hosted.gatewayId,
          CLOUDFLARE_GATEWAY_ID: hosted.gatewayId,
        }
      : hosted?.kind === "rest"
        ? {
            CLOUDFLARE_ACCOUNT_ID: hosted.accountId,
            CLOUDFLARE_API_TOKEN: hosted.apiToken,
            CLOUDFLARE_API_KEY: hosted.apiToken,
            CLOUDFLARE_AI_GATEWAY_TOKEN: hosted.apiToken,
            CLOUDFLARE_AI_GATEWAY_ID: hosted.gatewayId,
            CLOUDFLARE_GATEWAY_ID: hosted.gatewayId,
          }
        : {}),
  };
}
