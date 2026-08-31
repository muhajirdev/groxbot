import * as z from "zod";

export const ANTHROPIC_PROVIDER = "anthropic" as const;
export const OPENAI_PROVIDER = "openai" as const;
export const OPENROUTER_PROVIDER = "openrouter" as const;
export const CLOUDFLARE_PROVIDER = "cloudflare" as const;

export const ModelProvider = z.enum([
  ANTHROPIC_PROVIDER,
  OPENAI_PROVIDER,
  OPENROUTER_PROVIDER,
  CLOUDFLARE_PROVIDER,
]);
export type ModelProvider = z.infer<typeof ModelProvider>;

/** Settings UI order: OpenRouter first (one-key starter). */
export const PROVIDER_ORDER: ModelProvider[] = [
  OPENROUTER_PROVIDER,
  ANTHROPIC_PROVIDER,
  OPENAI_PROVIDER,
  CLOUDFLARE_PROVIDER,
];

export const ModelKeySource = z.enum(["workspace", "env", "none"]);
export type ModelKeySource = z.infer<typeof ModelKeySource>;

/** One-key starter. Native Anthropic/OpenAI stay available when those keys exist. */
export const SUGGESTED_STARTER_MODEL = "openrouter/deepseek/deepseek-v4-flash";

/** Built-in Groxbot gateway (Cloudflare AI Gateway → Workers AI). */
export const HOSTED_STARTER_MODEL =
  "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-5.3-flash";

/** Product brain. Worker `AI` binding, else REST gateway keys. */
export const PRODUCT_RUNTIME = CLOUDFLARE_PROVIDER;
export type ProductRuntime = typeof PRODUCT_RUNTIME;

/** Cloudflare AI Gateway id when none is configured. */
export const DEFAULT_AI_GATEWAY_ID = "default" as const;

/** Overlay flag: this host includes Groxbot’s Workers AI binding. */
export const HOSTED_AI_ENV = "GROXBOT_HOSTED_AI" as const;
export const HOSTED_AI_FLAG = "1" as const;

/** Settings sentinel: user typed a model id that is not in the catalog. */
export const CUSTOM_MODEL_SENTINEL = "custom" as const;

export const IN_PROCESS_WAKEUP = "in-process" as const;
export const HTTP_WAKEUP = "http" as const;
export const DURABLE_OBJECT_WAKEUP = "durable-object" as const;
export const WakeupKind = z.enum([
  IN_PROCESS_WAKEUP,
  HTTP_WAKEUP,
  DURABLE_OBJECT_WAKEUP,
]);
export type WakeupKind = z.infer<typeof WakeupKind>;

export const MAIL_CLOUDFLARE = CLOUDFLARE_PROVIDER;
export const MAIL_LOG = "log" as const;
export const MailKind = z.enum([MAIL_CLOUDFLARE, MAIL_LOG]);
export type MailKind = z.infer<typeof MailKind>;

export function hostedAiEnabled(
  env: { [HOSTED_AI_ENV]?: string } = {},
): boolean {
  return Boolean(env[HOSTED_AI_ENV]?.trim());
}

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
  [OPENROUTER_PROVIDER]: {
    label: "OpenRouter",
    placeholder: "sk-or-…",
    docsUrl: "https://openrouter.ai/keys",
    hint: "One key for many models. Best first step.",
    recommended: true,
  },
  [ANTHROPIC_PROVIDER]: {
    label: "Anthropic",
    placeholder: "sk-ant-…",
    docsUrl: "https://console.anthropic.com/settings/keys",
    hint: "Direct Claude. Use this if you already have an Anthropic key.",
  },
  [OPENAI_PROVIDER]: {
    label: "OpenAI",
    placeholder: "sk-…",
    docsUrl: "https://platform.openai.com/api-keys",
    hint: "Direct OpenAI models.",
  },
  [CLOUDFLARE_PROVIDER]: {
    label: "Cloudflare AI Gateway",
    placeholder: "API token",
    docsUrl:
      "https://developers.cloudflare.com/ai-gateway/integrations/coding-agents/pi/",
    hint: `Account id and API token. Gateway id can stay ${DEFAULT_AI_GATEWAY_ID}.`,
  },
};

/** Model picker group. Hosted catalog models are Groxbot, not the upstream vendor. */
export function catalogGroupLabel(provider: ModelProvider): string {
  if (provider === CLOUDFLARE_PROVIDER) return "Groxbot";
  return PROVIDER_META[provider].label;
}

/** Groxbot picker: hide OpenRouter / Anthropic / OpenAI while a Groxbot model is selected. */
export function pickerCatalog<T extends { id: string; provider: ModelProvider }>(
  catalog: readonly T[],
  selectedModelId: string,
): T[] {
  const selected = selectedModelId.trim();
  if (!selected || selected === CUSTOM_MODEL_SENTINEL) return [...catalog];
  const listed = catalog.find((item) => item.id === selected);
  const provider = listed?.provider ?? providerForModel(selected);
  if (provider !== CLOUDFLARE_PROVIDER) return [...catalog];
  return catalog.filter((item) => item.provider === CLOUDFLARE_PROVIDER);
}

export const MODEL_CATALOG = [
  {
    id: "openrouter/deepseek/deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    provider: OPENROUTER_PROVIDER,
  },
  {
    id: "openrouter/anthropic/claude-sonnet-4.6",
    label: "Claude Sonnet 4.6 (OpenRouter)",
    provider: OPENROUTER_PROVIDER,
  },
  {
    id: "openrouter/openai/gpt-4o-mini",
    label: "GPT-4o mini (OpenRouter)",
    provider: OPENROUTER_PROVIDER,
  },
  {
    id: "anthropic/claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: ANTHROPIC_PROVIDER,
  },
  {
    id: "anthropic/claude-opus-4-6",
    label: "Claude Opus 4.6",
    provider: ANTHROPIC_PROVIDER,
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    provider: OPENAI_PROVIDER,
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o mini",
    provider: OPENAI_PROVIDER,
  },
  {
    id: "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-5.3-flash",
    label: "GLM 5.3 Flash",
    provider: CLOUDFLARE_PROVIDER,
  },
  {
    id: "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
    label: "DeepSeek V4 Flash",
    provider: CLOUDFLARE_PROVIDER,
  },
  {
    id: "cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-pro-0813",
    label: "DeepSeek V4 Pro",
    provider: CLOUDFLARE_PROVIDER,
  },
  {
    id: "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-4.7-flash",
    label: "GLM 4.7 Flash",
    provider: CLOUDFLARE_PROVIDER,
  },
  {
    id: "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-5.2",
    label: "GLM 5.2",
    provider: CLOUDFLARE_PROVIDER,
  },
  {
    id: "cloudflare-ai-gateway/workers-ai/@cf/moonshotai/kimi-k2.6",
    label: "Kimi K2.6",
    provider: CLOUDFLARE_PROVIDER,
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
  runtime: z.literal(PRODUCT_RUNTIME),
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
  const gatewayId =
    env.CLOUDFLARE_AI_GATEWAY_ID?.trim() || DEFAULT_AI_GATEWAY_ID;
  if (hostedAiEnabled(env)) {
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
  if (trimmed.startsWith("anthropic/")) return ANTHROPIC_PROVIDER;
  if (trimmed.startsWith("openai/")) return OPENAI_PROVIDER;
  if (trimmed.startsWith("openrouter/")) return OPENROUTER_PROVIDER;
  if (
    trimmed.startsWith("cloudflare-ai-gateway/") ||
    trimmed.startsWith("cloudflare-workers-ai/") ||
    trimmed.startsWith("workers-ai/@cf/") ||
    trimmed.startsWith("@cf/")
  ) {
    return CLOUDFLARE_PROVIDER;
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
  if (input.defaultModel === CUSTOM_MODEL_SENTINEL) {
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
  if (provider === ANTHROPIC_PROVIDER && !value.startsWith("sk-ant-")) {
    return "Anthropic keys start with sk-ant-.";
  }
  if (provider === OPENROUTER_PROVIDER && !value.startsWith("sk-or-")) {
    return "OpenRouter keys start with sk-or-.";
  }
  if (
    provider === OPENAI_PROVIDER &&
    (value.startsWith("sk-ant-") || value.startsWith("sk-or-"))
  ) {
    return "That key belongs to another provider.";
  }
  if (provider === OPENAI_PROVIDER && !value.startsWith("sk-")) {
    return "OpenAI keys start with sk-.";
  }
  if (provider === CLOUDFLARE_PROVIDER && value.length < 20) {
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
