import type { StreamFn } from "@earendil-works/pi-agent-core";
import {
  type Api,
  type AssistantMessage,
  createAssistantMessageEventStream,
  createModels,
  createProvider,
  envApiKeyAuth,
  type Model,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { moonshotaiProvider } from "@earendil-works/pi-ai/providers/moonshotai";
import { zaiProvider } from "@earendil-works/pi-ai/providers/zai";
import {
  isNativeCompatProvider,
  MOONSHOT_API_KEY_ENV,
  MOONSHOT_CHAT_BASE_URL,
  MOONSHOT_PROVIDER,
  missingProviderMessage,
  type NativeCompatProvider,
  providerForModel,
  ZAI_API_KEY_ENV,
  ZAI_CHAT_BASE_URL,
  ZAI_PROVIDER,
} from "@groxbot/contracts";
import type { GatewayEnv } from "./gateway.js";
import { withAssistantUsage } from "./pi-context-usage.js";

let nativeModels: ReturnType<typeof createModels> | undefined;

function asCompletions(
  model: Model<Api> | undefined,
): Model<"openai-completions"> | undefined {
  if (model?.api === "openai-completions") {
    return model as Model<"openai-completions">;
  }
  return undefined;
}

function rewriteCompletions(
  model: Model<"openai-completions">,
  provider: NativeCompatProvider,
  baseUrl: string,
): Model<"openai-completions"> {
  return { ...model, provider, baseUrl };
}

function groxbotZaiProvider() {
  const stock = zaiProvider();
  return createProvider({
    id: ZAI_PROVIDER,
    name: "z.ai",
    baseUrl: ZAI_CHAT_BASE_URL,
    auth: { apiKey: envApiKeyAuth("z.ai API key", [ZAI_API_KEY_ENV]) },
    models: stock
      .getModels()
      .filter(
        (model): model is Model<"openai-completions"> =>
          model.api === "openai-completions",
      )
      .map((model) =>
        rewriteCompletions(model, ZAI_PROVIDER, ZAI_CHAT_BASE_URL),
      ),
    api: openAICompletionsApi(),
  });
}

function groxbotMoonshotProvider() {
  const stock = moonshotaiProvider();
  return createProvider({
    id: MOONSHOT_PROVIDER,
    name: "Moonshot",
    baseUrl: MOONSHOT_CHAT_BASE_URL,
    auth: {
      apiKey: envApiKeyAuth("Moonshot API key", [MOONSHOT_API_KEY_ENV]),
    },
    models: stock
      .getModels()
      .filter(
        (model): model is Model<"openai-completions"> =>
          model.api === "openai-completions",
      )
      .map((model) =>
        rewriteCompletions(model, MOONSHOT_PROVIDER, MOONSHOT_CHAT_BASE_URL),
      ),
    api: openAICompletionsApi(),
  });
}

function getNativeCompatModels() {
  if (!nativeModels) {
    nativeModels = createModels();
    nativeModels.setProvider(groxbotZaiProvider());
    nativeModels.setProvider(groxbotMoonshotProvider());
  }
  return nativeModels;
}

export function nativeCompatRequestModel(model: string): string {
  const trimmed = model.trim();
  if (trimmed.startsWith("zai/")) return trimmed.slice("zai/".length);
  if (trimmed.startsWith("moonshot/")) return trimmed.slice("moonshot/".length);
  return trimmed;
}

function fallbackNativeModel(
  provider: NativeCompatProvider,
  id: string,
): Model<"openai-completions"> {
  if (provider === ZAI_PROVIDER) {
    return {
      id,
      name: id,
      api: "openai-completions",
      provider: ZAI_PROVIDER,
      baseUrl: ZAI_CHAT_BASE_URL,
      reasoning: true,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 1_000_000,
      maxTokens: 131_072,
      compat: {
        supportsStore: false,
        supportsDeveloperRole: false,
        supportsReasoningEffort: true,
        maxTokensField: "max_tokens",
        thinkingFormat: "zai",
        zaiToolStream: true,
      },
    };
  }
  return {
    id,
    name: id,
    api: "openai-completions",
    provider: MOONSHOT_PROVIDER,
    baseUrl: MOONSHOT_CHAT_BASE_URL,
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 262_144,
    maxTokens: 262_144,
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      maxTokensField: "max_tokens",
      thinkingFormat: "deepseek",
    },
  };
}

export function resolveNativeCompatModel(
  modelId: string,
): Model<"openai-completions"> {
  const provider = providerForModel(modelId);
  if (!isNativeCompatProvider(provider)) {
    return fallbackNativeModel(ZAI_PROVIDER, nativeCompatRequestModel(modelId));
  }
  const id = nativeCompatRequestModel(modelId);
  return (
    asCompletions(getNativeCompatModels().getModel(provider, id)) ??
    fallbackNativeModel(provider, id)
  );
}

export function nativeCompatApiKeyFromEnv(
  source: GatewayEnv,
  provider: NativeCompatProvider,
): string | undefined {
  const key =
    provider === ZAI_PROVIDER
      ? source[ZAI_API_KEY_ENV]
      : source[MOONSHOT_API_KEY_ENV];
  const trimmed = key?.trim();
  return trimmed || undefined;
}

export function nativeCompatTurn(
  source: GatewayEnv,
  modelId?: string,
): boolean {
  const model = (modelId ?? source.GROXBOT_MODEL ?? "").trim();
  const provider = providerForModel(model);
  return (
    isNativeCompatProvider(provider) &&
    Boolean(nativeCompatApiKeyFromEnv(source, provider))
  );
}

export function nativeCompatKeyConfigured(source: GatewayEnv): boolean {
  return Boolean(
    nativeCompatApiKeyFromEnv(source, ZAI_PROVIDER) ||
      nativeCompatApiKeyFromEnv(source, MOONSHOT_PROVIDER),
  );
}

function errorNativeStream(
  model: Model<Api>,
  message: string,
): ReturnType<StreamFn> {
  const stream = createAssistantMessageEventStream();
  const assistant: AssistantMessage = {
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
    errorMessage: message,
    timestamp: Date.now(),
  };
  stream.push({ type: "error", reason: "error", error: assistant });
  stream.end(assistant);
  return stream;
}

export function missingNativeCompatStreamFn(modelId: string): StreamFn {
  const message = `${missingProviderMessage(modelId)} Open Settings → Models.`;
  return (model) => errorNativeStream(model, message);
}

function nativeStreamEnv(
  provider: NativeCompatProvider,
  apiKey: string,
): Record<string, string> {
  return {
    [provider === ZAI_PROVIDER ? ZAI_API_KEY_ENV : MOONSHOT_API_KEY_ENV]:
      apiKey,
  };
}

export function createNativeCompatStreamFn(options: {
  provider: NativeCompatProvider;
  apiKey: string;
  fetch?: typeof fetch;
}): StreamFn {
  return (model, context, streamOptions) => {
    try {
      const requested = nativeCompatRequestModel(model.id);
      const piModel = resolveNativeCompatModel(
        `${options.provider}/${requested}`,
      );
      return getNativeCompatModels().streamSimple(
        piModel,
        withAssistantUsage(context),
        {
          ...streamOptions,
          apiKey: options.apiKey,
          fetch: options.fetch,
          env: {
            ...streamOptions?.env,
            ...nativeStreamEnv(options.provider, options.apiKey),
          },
          maxRetries: streamOptions?.maxRetries ?? 0,
        },
      );
    } catch (error) {
      return errorNativeStream(
        model,
        error instanceof Error ? error.message : "Native model provider failed",
      );
    }
  };
}
