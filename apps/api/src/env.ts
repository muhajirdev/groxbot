import {
  CLOUD_API_ORIGIN,
  CLOUD_LANDING_ORIGIN,
  CLOUD_WEB_ORIGIN,
  DURABLE_OBJECT_WAKEUP,
  FAKE_SANDBOX,
  HOSTED_AI_ENV,
  HOSTED_AI_FLAG,
  HTTP_WAKEUP,
  hostedCloudflareGateway,
  IN_PROCESS_WAKEUP,
  STAGING_API_ORIGIN,
  STAGING_LANDING_ORIGIN,
  STAGING_WEB_ORIGIN,
  type WakeupKind,
} from "@groxbot/contracts";

export { DURABLE_OBJECT_WAKEUP, HTTP_WAKEUP, IN_PROCESS_WAKEUP };

export type OAuthProviderId = "google" | "github";

export interface Env {
  databaseUrl: string;
  authSecret: string;
  authUrl: string;
  webOrigin: string;
  corsOrigins: string[];
  sandboxProvider: string;
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
  emailBinding?: boolean;
  emailFrom?: string;
  encryptionKey?: string;
  composioApiKey?: string;
  production: boolean;
  wakeupKind: WakeupKind;
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

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const databaseUrl = source.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const authSecret = source.BETTER_AUTH_SECRET ?? "";
  if (authSecret.length < 32 && source.NODE_ENV === "production") {
    throw new Error(
      "BETTER_AUTH_SECRET must be at least 32 characters in production",
    );
  }
  const webOrigin = source.WEB_ORIGIN ?? "http://127.0.0.1:5173";
  return {
    databaseUrl,
    authSecret: authSecret || "development-only-change-me-please-32ch",
    authUrl: source.BETTER_AUTH_URL ?? "http://127.0.0.1:5173",
    webOrigin,
    corsOrigins: parseOrigins(source.CORS_ORIGINS, [
      webOrigin,
      CLOUD_LANDING_ORIGIN,
      CLOUD_WEB_ORIGIN,
      CLOUD_API_ORIGIN,
      STAGING_WEB_ORIGIN,
      STAGING_LANDING_ORIGIN,
      STAGING_API_ORIGIN,
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://127.0.0.1:5174",
      "http://localhost:5174",
      "http://127.0.0.1:8081",
      "http://localhost:8081",
    ]),
    sandboxProvider: source.SANDBOX_PROVIDER ?? FAKE_SANDBOX,
    workerUrl: source.WORKER_URL,
    apiUrl: source.API_URL ?? "http://127.0.0.1:3100",
    guestUrl: source.GUEST_URL,
    googleClientId: source.GOOGLE_CLIENT_ID,
    googleClientSecret: source.GOOGLE_CLIENT_SECRET,
    githubClientId: source.GITHUB_CLIENT_ID,
    githubClientSecret: source.GITHUB_CLIENT_SECRET,
    cloudflareAccountId: source.CLOUDFLARE_ACCOUNT_ID,
    cloudflareAiGatewayToken:
      source.CLOUDFLARE_AI_GATEWAY_TOKEN?.trim() ||
      source.CLOUDFLARE_API_TOKEN?.trim() ||
      undefined,
    cloudflareAiGatewayId: source.CLOUDFLARE_AI_GATEWAY_ID?.trim() || undefined,
    emailFrom: source.EMAIL_FROM,
    encryptionKey: source.ENCRYPTION_KEY,
    composioApiKey: source.COMPOSIO_API_KEY?.trim() || undefined,
    production: source.NODE_ENV === "production",
    wakeupKind:
      source.WAKEUP_KIND === DURABLE_OBJECT_WAKEUP
        ? DURABLE_OBJECT_WAKEUP
        : source.WORKER_URL
          ? HTTP_WAKEUP
          : IN_PROCESS_WAKEUP,
  };
}

/** Process env for agent boot / model settings. Hosted CF gateway + encryption. */
export function agentRuntimeSource(env: Env): NodeJS.ProcessEnv {
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
