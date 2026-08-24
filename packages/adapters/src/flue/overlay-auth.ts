import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import { setProvider } from "@flue/runtime";

const ENV_ALIASES: Record<string, readonly string[]> = {
  CLOUDFLARE_API_KEY: [
    "CLOUDFLARE_API_KEY",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_AI_GATEWAY_TOKEN",
    "CLOUDFLARE_AUTH_TOKEN",
  ],
  CLOUDFLARE_GATEWAY_ID: ["CLOUDFLARE_GATEWAY_ID", "CLOUDFLARE_AI_GATEWAY_ID"],
  CLOUDFLARE_ACCOUNT_ID: ["CLOUDFLARE_ACCOUNT_ID"],
};

type AuthCtx = {
  env: (name: string) => Promise<string | undefined>;
  fileExists: (path: string) => Promise<boolean>;
};

type ApiKeyAuth = {
  resolve: (input: { ctx: AuthCtx; credential?: unknown }) => Promise<unknown>;
  check?: (input: { ctx: AuthCtx; credential?: unknown }) => Promise<unknown>;
};

type OverlayProvider = {
  auth: { apiKey?: ApiKeyAuth };
};

function readEnv(
  source: NodeJS.ProcessEnv,
  name: string,
): string | undefined {
  for (const key of ENV_ALIASES[name] ?? [name]) {
    const value = source[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** Pi's default auth reads process.env. Workspace BYOK lives on the overlay. */
export function overlayAuthContext(
  base: AuthCtx,
  env: NodeJS.ProcessEnv,
): AuthCtx {
  return {
    env: async (name) => readEnv(env, name) ?? (await base.env(name)),
    fileExists: (path) => base.fileExists(path),
  };
}

/** Point a Pi provider's api-key auth at the mutable workspace overlay. */
export function withOverlayAuth<T extends OverlayProvider>(
  provider: T,
  env: NodeJS.ProcessEnv,
): T {
  const apiKey = provider.auth.apiKey;
  if (!apiKey) return provider;
  const resolve = apiKey.resolve.bind(apiKey);
  apiKey.resolve = (input) =>
    resolve({
      ...input,
      ctx: overlayAuthContext(input.ctx, env),
    });
  if (apiKey.check) {
    const check = apiKey.check.bind(apiKey);
    apiKey.check = (input) =>
      check({
        ...input,
        ctx: overlayAuthContext(input.ctx, env),
      });
  }
  return provider;
}

/**
 * Flue registers Pi builtins against process.env. Re-register them so Settings
 * keys on the overlay (OpenRouter, Anthropic, OpenAI, Cloudflare, …) resolve.
 */
export function installWorkspaceProviderAuth(env: NodeJS.ProcessEnv): void {
  for (const provider of builtinProviders()) {
    setProvider(withOverlayAuth(provider, env));
  }
}
