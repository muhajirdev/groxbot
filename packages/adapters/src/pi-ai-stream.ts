import type { StreamFn } from "@earendil-works/pi-agent-core";
import {
  createAssistantMessageEventStream,
  createModels,
  type Api,
  type AssistantMessage,
  type Model,
} from "@earendil-works/pi-ai";
import { cloudflareAIGatewayProvider } from "@earendil-works/pi-ai/providers/cloudflare-ai-gateway";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
import {
  CLOUDFLARE_PROVIDER,
  OPENROUTER_PROVIDER,
} from "@groxbot/contracts";
import type { GatewayConfig, GatewayProvider } from "./gateway.js";

const CLOUDFLARE_AI_GATEWAY = "cloudflare-ai-gateway";
const WORKERS_AI_PREFIX = "workers-ai/";
const GATEWAY_COMPLETIONS_TEMPLATE_ID =
  "workers-ai/@cf/zai-org/glm-4.7-flash";

let officeModels: ReturnType<typeof createModels> | undefined;

function getOfficePiModels() {
  if (!officeModels) {
    officeModels = createModels();
    officeModels.setProvider(cloudflareAIGatewayProvider());
    officeModels.setProvider(openrouterProvider());
  }
  return officeModels;
}

function asCompletions(
  model: Model<Api> | undefined,
): Model<"openai-completions"> | undefined {
  if (model?.api === "openai-completions") {
    return model as Model<"openai-completions">;
  }
  return undefined;
}

function cloneCompletions(
  template: Model<"openai-completions">,
  id: string,
): Model<"openai-completions"> {
  return {
    ...template,
    id,
    name: id,
  };
}

/** Unified AI Gateway `/compat` model id (`workers-ai/@cf/...`). */
export function piAiGatewayModelId(model: string): string {
  const trimmed = model.trim();
  const cfIndex = trimmed.indexOf("@cf/");
  if (cfIndex >= 0) {
    const workers = trimmed.slice(cfIndex);
    return workers.startsWith(WORKERS_AI_PREFIX)
      ? workers
      : `${WORKERS_AI_PREFIX}${workers}`;
  }
  if (trimmed.startsWith("cloudflare-ai-gateway/")) {
    return trimmed.slice("cloudflare-ai-gateway/".length);
  }
  return trimmed;
}

export function piAiOpenRouterModelId(model: string): string {
  const trimmed = model.trim();
  if (trimmed.startsWith("openrouter/")) {
    return trimmed.slice("openrouter/".length);
  }
  return trimmed;
}

export function piAiRequestModel(
  provider: GatewayProvider,
  model: string,
): string {
  return provider === OPENROUTER_PROVIDER
    ? piAiOpenRouterModelId(model)
    : piAiGatewayModelId(model);
}

function fallbackGatewayModel(id: string): Model<"openai-completions"> {
  return {
    id,
    name: id,
    api: "openai-completions",
    provider: CLOUDFLARE_AI_GATEWAY,
    baseUrl:
      "https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/{CLOUDFLARE_GATEWAY_ID}/compat",
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 131_072,
    maxTokens: 131_072,
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      maxTokensField: "max_tokens",
      supportsStrictMode: false,
      supportsLongCacheRetention: false,
      sendSessionAffinityHeaders: true,
    },
  };
}

function fallbackOpenRouterModel(id: string): Model<"openai-completions"> {
  return {
    id,
    name: id,
    api: "openai-completions",
    provider: OPENROUTER_PROVIDER,
    baseUrl: "https://openrouter.ai/api/v1",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8192,
    compat: {
      supportsDeveloperRole: false,
      thinkingFormat: "openrouter",
    },
  };
}

export function resolvePiAiModel(
  config: GatewayConfig,
  modelId?: string,
): Model<"openai-completions"> {
  const requested = (modelId?.trim() || config.model).trim();
  const models = getOfficePiModels();
  if (config.provider === OPENROUTER_PROVIDER) {
    const id = piAiOpenRouterModelId(requested);
    return (
      asCompletions(models.getModel(OPENROUTER_PROVIDER, id)) ??
      fallbackOpenRouterModel(id)
    );
  }
  const id = piAiGatewayModelId(requested);
  if (config.groxGatewayUrl) {
    const baseUrl = config.groxGatewayUrl.replace(/\/$/, "");
    const template = fallbackGatewayModel(GATEWAY_COMPLETIONS_TEMPLATE_ID);
    return {
      ...cloneCompletions(template, id),
      // Grox gateway is OpenAI-compatible; cloudflare-ai-gateway auth needs CF account env.
      provider: OPENROUTER_PROVIDER,
      baseUrl: baseUrl.endsWith("/v1") || baseUrl.endsWith("/compat")
        ? baseUrl
        : `${baseUrl}/v1`,
    };
  }
  const found = asCompletions(models.getModel(CLOUDFLARE_AI_GATEWAY, id));
  if (found) return found;
  const template =
    asCompletions(
      models.getModel(CLOUDFLARE_AI_GATEWAY, GATEWAY_COMPLETIONS_TEMPLATE_ID),
    ) ?? fallbackGatewayModel(GATEWAY_COMPLETIONS_TEMPLATE_ID);
  return cloneCompletions(template, id);
}

function packedMetadata(
  metadata?: Record<string, string | undefined>,
): Record<string, string> | null {
  if (!metadata) return null;
  const packed: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const trimmed = value?.trim();
    if (trimmed) packed[key] = trimmed;
  }
  return Object.keys(packed).length > 0 ? packed : null;
}

function piAiStreamHeaders(
  config: GatewayConfig,
  metadata?: Record<string, string | undefined>,
): Record<string, string> {
  if (config.groxGatewayUrl) {
    const headers: Record<string, string> = {};
    const workspaceId = metadata?.workspaceId?.trim();
    const userId = metadata?.userId?.trim();
    if (workspaceId) headers["X-Grox-Workspace-Id"] = workspaceId;
    if (userId) headers["X-Grox-User-Id"] = userId;
    return headers;
  }
  if (config.provider === OPENROUTER_PROVIDER) {
    return {
      "HTTP-Referer": config.referer,
      "X-Title": config.title,
      "X-OpenRouter-Title": config.title,
    };
  }
  const packed = packedMetadata(metadata);
  return packed ? { "cf-aig-metadata": JSON.stringify(packed) } : {};
}

function piAiStreamEnv(config: GatewayConfig): Record<string, string> {
  if (config.groxGatewayUrl) return {};
  if (config.provider !== CLOUDFLARE_PROVIDER || !config.accountId) {
    return {};
  }
  return {
    CLOUDFLARE_API_KEY: config.apiKey,
    CLOUDFLARE_ACCOUNT_ID: config.accountId,
    CLOUDFLARE_GATEWAY_ID: config.gatewayId ?? "default",
  };
}

/**
 * Pi `StreamFn` via `@earendil-works/pi-ai` (Cloudflare AI Gateway + OpenRouter).
 * Must not throw — failures are `stopReason` error/aborted on the assistant message.
 */
export function createGatewayStreamFn(
  config: GatewayConfig,
  metadata?: Record<string, string | undefined>,
): StreamFn {
  return (model, context, options) => {
    try {
      const piModel = resolvePiAiModel(config, model.id || config.model);
      return getOfficePiModels().streamSimple(piModel, context, {
        ...options,
        apiKey: config.apiKey,
        fetch: config.fetch,
        env: { ...options?.env, ...piAiStreamEnv(config) },
        headers: {
          ...options?.headers,
          ...piAiStreamHeaders(config, metadata),
        },
        maxRetries: options?.maxRetries ?? 0,
      });
    } catch (error) {
      const stream = createAssistantMessageEventStream();
      const message: AssistantMessage = {
        role: "assistant",
        content: [],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "error",
        errorMessage:
          error instanceof Error ? error.message : "AI gateway failed",
        timestamp: Date.now(),
      };
      stream.push({ type: "error", reason: "error", error: message });
      stream.end(message);
      return stream;
    }
  };
}
