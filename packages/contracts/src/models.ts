import * as z from "zod";

export const ModelProvider = z.enum([
  "anthropic",
  "openai",
  "openrouter",
  "cloudflare",
]);
export type ModelProvider = z.infer<typeof ModelProvider>;

export const ModelKeySource = z.enum(["workspace", "env", "none"]);
export type ModelKeySource = z.infer<typeof ModelKeySource>;

/** One-key starter. Native Anthropic/OpenAI stay available when those keys exist. */
export const SUGGESTED_STARTER_MODEL = "openrouter/deepseek/deepseek-v4-flash";

/** Built-in Groxbot gateway (Cloudflare AI Gateway → Workers AI). */
export const HOSTED_STARTER_MODEL =
  "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731";

export const PROVIDER_META: Record<
  ModelProvider,
  {
    label: string;
    placeholder: string;
    docsUrl: string;
    hint: string;
    recommended?: boolean;
  }
> = {
  openrouter: {
    label: "OpenRouter",
    placeholder: "sk-or-…",
    docsUrl: "https://openrouter.ai/keys",
    hint: "One key for many models. Best first step.",
    recommended: true,
  },
  anthropic: {
    label: "Anthropic",
    placeholder: "sk-ant-…",
    docsUrl: "https://console.anthropic.com/settings/keys",
    hint: "Direct Claude. Use this if you already have an Anthropic key.",
  },
  openai: {
    label: "OpenAI",
    placeholder: "sk-…",
    docsUrl: "https://platform.openai.com/api-keys",
    hint: "Direct OpenAI models.",
  },
  cloudflare: {
    label: "Cloudflare AI Gateway",
    placeholder: "API token",
    docsUrl:
      "https://developers.cloudflare.com/ai-gateway/integrations/coding-agents/pi/",
    hint: "Pi routes through your gateway (Workers AI, and Anthropic/OpenAI when billed on the gateway). Account id + token; gateway id can stay default.",
  },
};

export const MODEL_CATALOG = [
  {
    id: "openrouter/deepseek/deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    provider: "openrouter" as const,
  },
  {
    id: "openrouter/anthropic/claude-sonnet-4.6",
    label: "Claude Sonnet 4.6 (OpenRouter)",
    provider: "openrouter" as const,
  },
  {
    id: "openrouter/openai/gpt-4o-mini",
    label: "GPT-4o mini (OpenRouter)",
    provider: "openrouter" as const,
  },
  {
    id: "anthropic/claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic" as const,
  },
  {
    id: "anthropic/claude-opus-4-6",
    label: "Claude Opus 4.6",
    provider: "anthropic" as const,
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    provider: "openai" as const,
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "openai" as const,
  },
  {
    id: "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
    label: "DeepSeek V4 Flash (Workers AI)",
    provider: "cloudflare" as const,
  },
  {
    id: "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-pro-0813",
    label: "DeepSeek V4 Pro (Workers AI)",
    provider: "cloudflare" as const,
  },
  {
    id: "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-4.7-flash",
    label: "GLM 4.7 Flash (Workers AI)",
    provider: "cloudflare" as const,
  },
  {
    id: "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-5.2",
    label: "GLM 5.2 (Workers AI)",
    provider: "cloudflare" as const,
  },
  {
    id: "cloudflare-ai-gateway/workers-ai/@cf/moonshotai/kimi-k2.6",
    label: "Kimi K2.6 (Workers AI)",
    provider: "cloudflare" as const,
  },
] as const;

export type CatalogModelId = (typeof MODEL_CATALOG)[number]["id"];

export const ModelKeyStatusSchema = z.object({
  provider: ModelProvider,
  configured: z.boolean(),
  source: ModelKeySource,
  hint: z.string().nullable(),
  accountId: z.string().nullable(),
  gatewayId: z.string().nullable(),
});
export type ModelKeyStatus = z.infer<typeof ModelKeyStatusSchema>;

export const ModelCatalogItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: ModelProvider,
  available: z.boolean(),
});
export type ModelCatalogItem = z.infer<typeof ModelCatalogItemSchema>;

export const ModelSettingsSchema = z.object({
  keys: z.array(ModelKeyStatusSchema),
  defaultModel: z.string(),
  customModel: z.string(),
  defaultModelId: z.string(),
  fromEnv: z.boolean(),
  hostedGateway: z.boolean(),
  runtime: z.string(),
  catalog: z.array(ModelCatalogItemSchema),
  warning: z.string().nullable(),
  usage: z.object({
    requests: z.number().int(),
    promptTokens: z.number().int(),
    completionTokens: z.number().int(),
    totalTokens: z.number().int(),
  }),
});
export type ModelSettings = z.infer<typeof ModelSettingsSchema>;

export const SaveModelKeyInput = z.object({
  provider: ModelProvider,
  secret: z.string().max(8000).optional(),
  accountId: z.string().max(80).optional(),
  gatewayId: z.string().max(80).optional(),
  clear: z.boolean().optional(),
});

export const SaveModelSettingsInput = z.object({
  keys: z.array(SaveModelKeyInput).max(8),
  defaultModel: z.string().min(1).max(200),
  customModel: z.string().max(200).optional(),
});
export type SaveModelSettingsInput = z.infer<typeof SaveModelSettingsInput>;

export function isGatewayRuntime(runtime: string | undefined): boolean {
  const kind = runtime?.trim() || "flue";
  return kind === "gateway" || kind === "cloudflare" || kind === "openrouter";
}

export function isOfflineRuntime(runtime: string | undefined): boolean {
  const kind = runtime?.trim();
  return kind === "scripted" || kind === "flue-echo";
}

/** Groxbot’s included Cloudflare AI Gateway. Worker `AI` binding, or REST tokens on Node. */
export type HostedCloudflareGateway =
  | { kind: "binding"; gatewayId: string }
  | {
      kind: "rest";
      accountId: string;
      apiToken: string;
      gatewayId: string;
    };

export function hostedCloudflareGateway(
  env: NodeJS.Dict<string> = process.env,
): HostedCloudflareGateway | null {
  const gatewayId = env.CLOUDFLARE_AI_GATEWAY_ID?.trim() || "default";
  if (env.GROXBOT_HOSTED_AI?.trim()) {
    return { kind: "binding", gatewayId };
  }
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const apiToken =
    env.CLOUDFLARE_AI_GATEWAY_TOKEN?.trim() ||
    env.CLOUDFLARE_API_TOKEN?.trim() ||
    "";
  if (!accountId || !apiToken) return null;
  return { kind: "rest", accountId, apiToken, gatewayId };
}

export function providerForModel(model: string): ModelProvider | undefined {
  const trimmed = model.trim();
  const listed = MODEL_CATALOG.find((item) => item.id === trimmed);
  if (listed) return listed.provider;
  if (trimmed.startsWith("anthropic/")) return "anthropic";
  if (trimmed.startsWith("openai/")) return "openai";
  if (trimmed.startsWith("openrouter/")) return "openrouter";
  if (
    trimmed.startsWith("cloudflare-ai-gateway/") ||
    trimmed.startsWith("cloudflare-workers-ai/") ||
    trimmed.startsWith("workers-ai/@cf/") ||
    trimmed.startsWith("@cf/")
  ) {
    return "cloudflare";
  }
  return undefined;
}

/** Chat-completions body id. Workers AI through the unified API wants `@cf/…`. */
export function gatewayRequestModel(model: string): string {
  const trimmed = model.trim();
  const cfIndex = trimmed.indexOf("@cf/");
  if (cfIndex >= 0) return trimmed.slice(cfIndex);
  if (trimmed.startsWith("openrouter/")) {
    return trimmed.slice("openrouter/".length);
  }
  if (trimmed.startsWith("cloudflare-ai-gateway/")) {
    const rest = trimmed.slice("cloudflare-ai-gateway/".length);
    return rest.startsWith("workers-ai/")
      ? rest.slice("workers-ai/".length)
      : rest;
  }
  return trimmed;
}

/** Map legacy / short Cloudflare ids onto Pi's cloudflare-ai-gateway provider.
 * Workers AI through the gateway uses `workers-ai/@cf/…` model ids (compat).
 */
export function flueModelId(model: string): string {
  const trimmed = model.trim();
  // Pi OpenRouter catalog uses deepseek/deepseek-v4-flash (no date suffix).
  if (
    trimmed === "openrouter/deepseek/deepseek-v4-flash-0731" ||
    trimmed === "deepseek/deepseek-v4-flash-0731"
  ) {
    return "openrouter/deepseek/deepseek-v4-flash";
  }
  if (trimmed.startsWith("@cf/")) {
    return `cloudflare-ai-gateway/workers-ai/${trimmed}`;
  }
  if (trimmed.startsWith("workers-ai/@cf/")) {
    return `cloudflare-ai-gateway/${trimmed}`;
  }
  // Direct Workers AI provider ids → gateway compat (we always require a gateway).
  if (trimmed.startsWith("cloudflare-workers-ai/@cf/")) {
    return `cloudflare-ai-gateway/workers-ai/${trimmed.slice("cloudflare-workers-ai/".length)}`;
  }
  return trimmed;
}

export function labelForModel(model: string): string {
  const trimmed = model.trim();
  const listed = MODEL_CATALOG.find((item) => item.id === trimmed);
  return listed?.label ?? trimmed;
}

export function catalogForRuntime(
  _runtime: string | undefined,
): Array<(typeof MODEL_CATALOG)[number]> {
  return [...MODEL_CATALOG];
}

export function modelsForProviders(
  providers: readonly ModelProvider[],
): Array<(typeof MODEL_CATALOG)[number]> {
  const set = new Set(providers);
  return MODEL_CATALOG.filter((item) => set.has(item.provider));
}

export function modelIsRunnable(
  model: string,
  configured: ReadonlySet<ModelProvider> | readonly ModelProvider[],
): boolean {
  const set = configured instanceof Set ? configured : new Set(configured);
  if (set.size === 0) return false;
  const provider = providerForModel(model);
  if (!provider) return set.size > 0;
  return set.has(provider);
}

export function missingProviderMessage(model: string): string {
  const provider = providerForModel(model);
  if (!provider) {
    return "This model id needs a provider key. Paste OpenRouter to cover custom ids.";
  }
  const label = PROVIDER_META[provider].label;
  const article = /^[aeiou]/i.test(label) ? "an" : "a";
  return `${labelForModel(model)} needs ${article} ${label} key.`;
}

export function resolveStoredModelId(input: {
  defaultModel: string;
  customModel?: string;
}): string {
  if (input.defaultModel === "custom") {
    return input.customModel?.trim() || SUGGESTED_STARTER_MODEL;
  }
  return input.defaultModel.trim();
}

const PLACEHOLDER_KEYS = new Set([
  "changeme",
  "replace-me",
  "your-api-key",
  "sk-ant-your-key",
  "sk-or-your-key",
]);

export function validateProviderSecret(
  provider: ModelProvider,
  secret: string,
): string | undefined {
  const value = secret.trim();
  if (!value)
    return "Paste a key, or leave the field blank to keep the current one.";
  if (value.includes("•") || value.includes("…")) {
    return "That looks like a hint, not a key. Paste the full secret.";
  }
  if (value.length < 12) return "That key is too short.";
  if (PLACEHOLDER_KEYS.has(value.toLowerCase())) {
    return "Paste a real API key, not a placeholder.";
  }
  if (/\s/.test(value)) return "Keys cannot contain spaces.";
  if (provider === "anthropic" && !value.startsWith("sk-ant-")) {
    return "Anthropic keys start with sk-ant-.";
  }
  if (provider === "openrouter" && !value.startsWith("sk-or-")) {
    return "OpenRouter keys start with sk-or-.";
  }
  if (
    provider === "openai" &&
    (value.startsWith("sk-ant-") || value.startsWith("sk-or-"))
  ) {
    return "That key belongs to another provider.";
  }
  if (provider === "openai" && !value.startsWith("sk-")) {
    return "OpenAI keys start with sk-.";
  }
  if (provider === "cloudflare" && value.length < 20) {
    return "That Cloudflare token is too short.";
  }
  return undefined;
}

export function validateModelId(model: string): string | undefined {
  const value = model.trim();
  if (!value) return "Enter a model id.";
  if (value.length > 200) return "That model id is too long.";
  if (/\s/.test(value)) return "Model ids cannot contain spaces.";
  if (
    value.includes("•") ||
    value.startsWith("sk-") ||
    value.startsWith("sk_")
  ) {
    return "That looks like an API key, not a model id.";
  }
  return undefined;
}

export function validateCloudflareAccountId(
  accountId: string,
): string | undefined {
  const value = accountId.trim();
  if (!value) return undefined;
  if (!/^[a-f0-9]{32}$/i.test(value)) {
    return "Cloudflare account ids are 32 hex characters.";
  }
  return undefined;
}
