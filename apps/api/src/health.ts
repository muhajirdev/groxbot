import { MAIL_CLOUDFLARE, MAIL_LOG, PRODUCT_RUNTIME } from "@groxbot/contracts";
import { type Env, oauthProviders } from "./env.js";
import { cloudflareMailConfigured } from "./mail.js";

export function healthPayload(
  env: Pick<
    Env,
    | "workerUrl"
    | "googleClientId"
    | "googleClientSecret"
    | "githubClientId"
    | "githubClientSecret"
    | "emailFrom"
    | "emailBinding"
    | "composioApiKey"
    | "wakeupKind"
  >,
) {
  return {
    ok: true as const,
    version: "0.0.1",
    runtime: PRODUCT_RUNTIME,
    wakeup: env.wakeupKind,
    oauth: oauthProviders(env),
    mail: cloudflareMailConfigured(env) ? MAIL_CLOUDFLARE : MAIL_LOG,
    composio: Boolean(env.composioApiKey?.trim()),
  };
}
