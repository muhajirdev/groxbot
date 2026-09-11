import * as z from "zod";

import {
  parseOpenAiCodexAuth,
} from "./openai-codex-auth.js";

export const ANTHROPIC_PROVIDER = "anthropic" as const;
export const OPENAI_PROVIDER = "openai" as const;
export const OPENAI_CODEX_PROVIDER = "openai-codex" as const;
export const OPENROUTER_PROVIDER = "openrouter" as const;
export const CLOUDFLARE_PROVIDER = "cloudflare" as const;

export const ModelProvider = z.enum([
  ANTHROPIC_PROVIDER,
  OPENAI_PROVIDER,
  OPENAI_CODEX_PROVIDER,
  OPENROUTER_PROVIDER,
  CLOUDFLARE_PROVIDER,
]);
export type ModelProvider = z.infer<typeof ModelProvider>;

/** Settings UI order: OpenRouter first (one-key starter). */
export const PROVIDER_ORDER: ModelProvider[] = [
  OPENROUTER_PROVIDER,
  ANTHROPIC_PROVIDER,
  OPENAI_PROVIDER,
  OPENAI_CODEX_PROVIDER,
  CLOUDFLARE_PROVIDER,
];

export const ModelKeySource = z.enum(["workspace", "env", "none"]);
export type ModelKeySource = z.infer<typeof ModelKeySource>;

/** One-key starter. Native Anthropic/OpenAI stay available when those keys exist. */
export const SUGGESTED_STARTER_MODEL = "openrouter/deepseek/deepseek-v4-flash";

/** Groxbot hosted routers. Free stays a gateway slug; Auto is OpenRouter Auto. */
export const GROXBOT_AUTO_MODEL = "groxbot/auto" as const;
export const GROXBOT_FREE_MODEL = "groxbot/free" as const;
/** OpenRouter Auto Router wire slug. Catalog / picker stay `groxbot/auto`. */
export const OPENROUTER_AUTO_MODEL = "openrouter/auto" as const;
export const OPENROUTER_AUTO_PLUGIN_ID = "auto-router" as const;
/** Current Auto allowlist — widen later without changing the picker. */
export const GROXBOT_AUTO_LUNA_MODEL = "openai/gpt-5.6-luna" as const;
export const GROXBOT_AUTO_ALLOWED_MODELS = [GROXBOT_AUTO_LUNA_MODEL] as const;
export const GROXBOT_AUTO_TARGET_LABEL = "GPT-5.6 Luna" as const;
/** Hosted catalog id for a pinned Luna. Not what Auto sends as `model`. */
export const GROXBOT_LUNA_MODEL = "groxbot/openai/gpt-5.6-luna" as const;

/** Self-host Worker AI binding starter. grox-gateway still accepts leftover `@cf/…` ids. */
export const BINDING_STARTER_MODEL =
  "cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-5.3-flash";

/** Hosted groxbot.com default. */
export const HOSTED_STARTER_MODEL = GROXBOT_AUTO_MODEL;

/** Product brain. Worker `AI` binding, else REST gateway keys. */
export const PRODUCT_RUNTIME = CLOUDFLARE_PROVIDER;
export type ProductRuntime = typeof PRODUCT_RUNTIME;

/** Cloudflare AI Gateway id when none is configured. */
export const DEFAULT_AI_GATEWAY_ID = "default" as const;

/** Overlay flag: this host includes Groxbot’s Workers AI binding. */
export const HOSTED_AI_ENV = "GROXBOT_HOSTED_AI" as const;
export const HOSTED_AI_FLAG = "1" as const;

/** Hosted models through the proprietary grox-gateway Worker (Polar-gated). */
export const GROX_GATEWAY_URL_ENV = "GROX_GATEWAY_URL" as const;
export const GROX_GATEWAY_SECRET_ENV = "GROX_GATEWAY_SECRET" as const;

export function groxHostedGateway(
  env: NodeJS.Dict<string> = process.env,
): { url: string; secret: string } | null {
  const url = env[GROX_GATEWAY_URL_ENV]?.trim() ?? "";
  const secret = env[GROX_GATEWAY_SECRET_ENV]?.trim() ?? "";
  if (!url || !secret) return null;
  return { url, secret };
}

/** Hosted grox-gateway default is Auto; self-host Worker AI stays on the binding starter. */
export function hostedStarterModel(
  env: NodeJS.Dict<string> = process.env,
): string {
  return groxHostedGateway(env) ? HOSTED_STARTER_MODEL : BINDING_STARTER_MODEL;
}

export function isGroxbotRouterModel(model: string): boolean {
  const trimmed = model.trim();
  return (
    trimmed === GROXBOT_AUTO_MODEL ||
    trimmed === GROXBOT_FREE_MODEL ||
    trimmed === "auto" ||
    trimmed === "free"
  );
}

export function isGroxbotAutoModel(model: string): boolean {
  const trimmed = model.trim();
  return trimmed === GROXBOT_AUTO_MODEL || trimmed === "auto";
}

export function isOpenRouterAutoModel(model: string): boolean {
  return model.trim() === OPENROUTER_AUTO_MODEL;
}

/** Catalog Auto or the OpenRouter Auto Router wire slug. */
export function isAutoRouterModel(model: string): boolean {
  return isGroxbotAutoModel(model) || isOpenRouterAutoModel(model);
}

export function openRouterAutoPlugin(
  allowed: readonly string[] = GROXBOT_AUTO_ALLOWED_MODELS,
): { id: typeof OPENROUTER_AUTO_PLUGIN_ID; allowed_models: string[] } {
  return {
    id: OPENROUTER_AUTO_PLUGIN_ID,
    allowed_models: [...allowed],
  };
}

/** Effort is for a pinned model. Auto / Free do not send reasoning. */
export function modelUsesThinkingEffort(model: string): boolean {
  const trimmed = model.trim();
  return (
    Boolean(trimmed) &&
    !isGroxbotRouterModel(trimmed) &&
    !isOpenRouterAutoModel(trimmed)
  );
}

/**
 * Catalog Auto stays `groxbot/auto`. The stream layer sends
 * {@link OPENROUTER_AUTO_MODEL} plus {@link openRouterAutoPlugin}.
 */
export function resolveGroxbotAutoModel(
  model: string,
  opts?: { hostedGateway?: boolean },
): string {
  const trimmed = model.trim();
  if (opts?.hostedGateway === false) return trimmed;
  if (isGroxbotAutoModel(trimmed)) return GROXBOT_AUTO_MODEL;
  return trimmed;
}

/**
 * Hosted grox-gateway catalog ids. OpenRouter-sourced models become
 * `groxbot/openai/…` (not `openrouter/…`) so the product prefix matches the host.
 * Auto stays `groxbot/auto` (OpenRouter Auto is the wire slug, not a catalog id).
 * Free stays `groxbot/free`.
 */
export function asHostedGroxbotModelId(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) return "";
  if (isOpenRouterAutoModel(trimmed)) return GROXBOT_AUTO_MODEL;
  if (isGroxbotRouterModel(trimmed)) {
    return trimmed.startsWith("groxbot/") ? trimmed : `groxbot/${trimmed}`;
  }
  if (trimmed.startsWith("groxbot/")) return trimmed;
  if (trimmed.startsWith("openrouter/")) {
    return `groxbot/${trimmed.slice("openrouter/".length)}`;
  }
  return `groxbot/${trimmed}`;
}

/** Reverse of {@link asHostedGroxbotModelId} for OpenRouter-shaped wire ids. */
export function openRouterIdFromHostedGroxbot(model: string): string {
  const trimmed = model.trim();
  if (!trimmed.startsWith("groxbot/") || isGroxbotRouterModel(trimmed)) {
    return trimmed;
  }
  return `openrouter/${trimmed.slice("groxbot/".length)}`;
}

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
  [OPENAI_CODEX_PROVIDER]: {
    label: "ChatGPT (Codex)",
    placeholder: '{ "tokens": { "refresh_token": "…" } }',
    docsUrl: "https://developers.openai.com/codex",
    hint: "ChatGPT Plus or Pro. Log in on your computer, then paste the auth file.",
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

/** Groxbot picker: hide unpaid vendor catalogs while a Groxbot model is selected.
 * Keep keyed providers visible. OpenRouter only appears when that provider is
 * selected (or has a key) — on hosted, OpenRouter models are listed under Groxbot. */
export function pickerCatalog<T extends { id: string; provider: ModelProvider }>(
  catalog: readonly T[],
  selectedModelId: string,
): T[] {
  const selected = selectedModelId.trim();
  if (!selected || selected === CUSTOM_MODEL_SENTINEL) return [...catalog];
  const listed = catalog.find((item) => item.id === selected);
  const provider = listed?.provider ?? providerForModel(selected);
  if (provider !== CLOUDFLARE_PROVIDER) return [...catalog];
  return catalog.filter((item) => {
    if (item.provider === CLOUDFLARE_PROVIDER) return true;
    return (
      "available" in item && Boolean((item as { available?: boolean }).available)
    );
  });
}

export const MODEL_CATALOG = [
  {
    id: GROXBOT_AUTO_MODEL,
    label: "Auto",
    provider: CLOUDFLARE_PROVIDER,
  },
  {
    id: GROXBOT_FREE_MODEL,
    label: "Free",
    provider: CLOUDFLARE_PROVIDER,
  },
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
    id: "openai-codex/gpt-5.4",
    label: "GPT-5.4 (ChatGPT)",
    provider: OPENAI_CODEX_PROVIDER,
  },
  {
    id: "openai-codex/gpt-5.4-mini",
    label: "GPT-5.4 mini (ChatGPT)",
    provider: OPENAI_CODEX_PROVIDER,
  },
  {
    id: "openai-codex/gpt-5.5",
    label: "GPT-5.5 (ChatGPT)",
    provider: OPENAI_CODEX_PROVIDER,
  },
  {
    id: "openai-codex/gpt-5.6-luna",
    label: "GPT-5.6 Luna (ChatGPT)",
    provider: OPENAI_CODEX_PROVIDER,
  },
  {
    id: "openai-codex/gpt-5.6-terra",
    label: "GPT-5.6 Terra (ChatGPT)",
    provider: OPENAI_CODEX_PROVIDER,
  },
  {
    id: "openai-codex/gpt-5.6-sol",
    label: "GPT-5.6 Sol (ChatGPT)",
    provider: OPENAI_CODEX_PROVIDER,
  },
  {
    id: "openai-codex/gpt-6-astra",
    label: "GPT-6 Astra (ChatGPT)",
    provider: OPENAI_CODEX_PROVIDER,
  },
  {
    id: "openai-codex/gpt-5.3-codex-spark",
    label: "GPT-5.3 Codex Spark",
    provider: OPENAI_CODEX_PROVIDER,
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

/** Shown in Settings when a ChatGPT / Codex model is selected. */
export const OPENAI_CODEX_SETUP_STEPS = [
  {
    title: "Log in on your computer",
    detail:
      "In a terminal, run npx @openai/codex login. ChatGPT Plus or Pro is required.",
  },
  {
    title: "Copy the auth file",
    detail:
      "Open ~/.codex/auth.json. If you signed in with Pi, use the openai-codex entry in ~/.pi/agent/auth.json.",
  },
  {
    title: "Paste it and save",
    detail:
      "Paste the whole JSON under ChatGPT (Codex) below. Groxbot stores it encrypted and refreshes the token.",
  },
] as const;

export function isOpenAiCodexModel(model: string): boolean {
  return providerForModel(model) === OPENAI_CODEX_PROVIDER;
}

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

/**
 * How hard the model thinks. `off` skips reasoning tokens.
 * Subset of Pi `ThinkingLevel` (no minimal/max).
 */
export const ThinkingEffort = z.enum(["off", "low", "medium", "high", "xhigh"]);
export type ThinkingEffort = z.infer<typeof ThinkingEffort>;

export const THINKING_EFFORT_LABELS: Record<ThinkingEffort, string> = {
  off: "Off",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
};

export const THINKING_EFFORT_OPTIONS: Array<{
  value: ThinkingEffort;
  label: string;
}> = ThinkingEffort.options.map((value) => ({
  value,
  label: THINKING_EFFORT_LABELS[value],
}));

export function thinkingEffortLabel(effort: string): string {
  const parsed = ThinkingEffort.safeParse(effort);
  return parsed.success ? THINKING_EFFORT_LABELS[parsed.data] : "Off";
}

export function parseThinkingEffort(
  value: string | null | undefined,
): ThinkingEffort {
  const parsed = ThinkingEffort.safeParse(value?.trim());
  return parsed.success ? parsed.data : "off";
}

/** Empty = inherit the workspace default. */
export function parseBotEffort(
  value: string | null | undefined,
): "" | ThinkingEffort {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  return parseThinkingEffort(trimmed);
}

export function resolveTurnEffort(
  botEffort?: string | null,
  workspaceEffort?: string | null,
): ThinkingEffort {
  const override = botEffort?.trim() ?? "";
  if (override) {
    const parsed = ThinkingEffort.safeParse(override);
    if (parsed.success) return parsed.data;
  }
  return parseThinkingEffort(workspaceEffort);
}

/** Pi `SimpleStreamOptions.reasoning` has no `off`. */
export function reasoningFromEffort(
  effort: ThinkingEffort,
): Exclude<ThinkingEffort, "off"> | undefined {
  return effort === "off" ? undefined : effort;
}

export const ModelSettingsSchema = z.object({
  keys: z.array(ModelKeyStatusSchema),
  defaultModel: z.string(),
  customModel: z.string(),
  defaultModelId: z.string(),
  /** Workspace default. Cached settings without this field parse as off. */
  effort: ThinkingEffort.default("off"),
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
    /** UTC calendar month the totals cover. */
    periodStart: z.string(),
    /** Null = unlimited (self-host). */
    monthlyTokenLimit: z.number().int().nullable(),
  }),
});
export type ModelSettings = z.infer<typeof ModelSettingsSchema>;

export const SaveModelKeyInput = z.object({
  provider: ModelProvider,
  secret: z.string().max(120_000).optional(),
  accountId: z.string().max(80).optional(),
  gatewayId: z.string().max(80).optional(),
  clear: z.boolean().optional(),
});

export const SaveModelSettingsInput = z.object({
  keys: z.array(SaveModelKeyInput).max(10),
  defaultModel: z.string().min(1).max(200),
  customModel: z.string().max(200).optional(),
  /** Omitted keeps the stored workspace effort. */
  effort: ThinkingEffort.optional(),
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
  // grox-gateway is the hosted office brain on groxbot.com. Same “included”
  // catalog as the Worker AI binding — do not make Settings ask for a key.
  if (groxHostedGateway(env) || hostedAiEnabled(env)) {
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
  if (trimmed.startsWith("openai-codex/")) return OPENAI_CODEX_PROVIDER;
  if (trimmed.startsWith("openai/")) return OPENAI_PROVIDER;
  if (trimmed.startsWith("openrouter/")) return OPENROUTER_PROVIDER;
  if (
    trimmed.startsWith("groxbot/") ||
    trimmed === "auto" ||
    trimmed === "free" ||
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
  if (isGroxbotRouterModel(trimmed) || trimmed.startsWith("groxbot/")) {
    return trimmed.startsWith("groxbot/")
      ? trimmed
      : (`groxbot/${trimmed}` as const);
  }
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

/** Map short Cloudflare ids onto AI Gateway Workers AI ids. */
export function gatewayModelId(model: string): string {
  const trimmed = model.trim();
  // OpenRouter catalog uses deepseek/deepseek-v4-flash (no date suffix).
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
  if (
    trimmed === GROXBOT_LUNA_MODEL ||
    trimmed === GROXBOT_AUTO_LUNA_MODEL
  ) {
    return GROXBOT_AUTO_TARGET_LABEL;
  }
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
  opts?: { hostedGateway?: boolean },
): boolean {
  const set = configured instanceof Set ? configured : new Set(configured);
  if (set.size === 0) return false;
  const provider = providerForModel(model);
  if (!provider) return set.size > 0;
  if (set.has(provider)) return true;
  // grox-gateway proxies OpenRouter — no customer OpenRouter key required.
  if (
    opts?.hostedGateway &&
    provider === OPENROUTER_PROVIDER &&
    set.has(CLOUDFLARE_PROVIDER)
  ) {
    return true;
  }
  return false;
}

export function missingProviderMessage(model: string): string {
  const provider = providerForModel(model);
  if (!provider) {
    return "This model id needs a provider key. Paste OpenRouter to cover custom ids.";
  }
  if (provider === OPENAI_CODEX_PROVIDER) {
    return `${labelForModel(model)} needs a ChatGPT Plus or Pro login. Paste ~/.codex/auth.json in Settings → Models.`;
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
  if (provider === OPENAI_CODEX_PROVIDER) {
    const parsed = parseOpenAiCodexAuth(value);
    return parsed.ok ? undefined : parsed.error;
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
