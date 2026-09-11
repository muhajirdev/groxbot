import type { StreamFn } from "@earendil-works/pi-agent-core";
import {
  createAssistantMessageEventStream,
  createModels,
  createProvider,
  type Api,
  type AssistantMessage,
  type Credential,
  type CredentialInfo,
  type CredentialStore,
  type Model,
  type OAuthAuth,
  type OAuthCredential,
} from "@earendil-works/pi-ai";
import { openAICodexResponsesApi } from "@earendil-works/pi-ai/api/openai-codex-responses.lazy";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";
import {
  OPENAI_CODEX_AUTH_ENV,
  OPENAI_CODEX_PROVIDER,
  packOpenAiCodexAuth,
  parseOpenAiCodexAuth,
  providerForModel,
  type OpenAiCodexAuth,
} from "@groxbot/contracts";
import type { GatewayEnv } from "./gateway.js";
import { withAssistantUsage } from "./pi-context-usage.js";

const CODEX_PROVIDER = "openai-codex";
const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token";
const JWT_AUTH_CLAIM = "https://api.openai.com/auth";

export function piAiCodexModelId(model: string): string {
  const trimmed = model.trim();
  if (trimmed.startsWith("openai-codex/")) {
    return trimmed.slice("openai-codex/".length);
  }
  return trimmed;
}

export function openaiCodexAuthFromEnv(
  source: GatewayEnv,
): OpenAiCodexAuth | undefined {
  const parsed = parseOpenAiCodexAuth(source[OPENAI_CODEX_AUTH_ENV] ?? "");
  return parsed.ok ? parsed.auth : undefined;
}

export function openaiCodexTurn(
  source: GatewayEnv,
  modelId?: string,
): boolean {
  const model = (modelId ?? source.GROXBOT_MODEL ?? "").trim();
  return (
    Boolean(openaiCodexAuthFromEnv(source)) &&
    providerForModel(model) === OPENAI_CODEX_PROVIDER
  );
}

function fallbackCodexModel(id: string): Model<"openai-codex-responses"> {
  return {
    id,
    name: id,
    api: "openai-codex-responses",
    provider: CODEX_PROVIDER,
    baseUrl: "https://chatgpt.com/backend-api",
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 272_000,
    maxTokens: 128_000,
  };
}

export function resolvePiAiCodexModel(
  modelId: string,
): Model<"openai-codex-responses"> {
  const id = piAiCodexModelId(modelId);
  const found = openaiCodexProvider()
    .getModels()
    .find((model) => model.id === id);
  if (found?.api === "openai-codex-responses") {
    return found as Model<"openai-codex-responses">;
  }
  return fallbackCodexModel(id);
}

function jwtPayload(token: string): Record<string, unknown> | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const parsed: unknown = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function accountIdFromAccess(access: string): string | undefined {
  const auth = jwtPayload(access)?.[JWT_AUTH_CLAIM];
  if (!auth || typeof auth !== "object" || Array.isArray(auth)) return undefined;
  const id = (auth as Record<string, unknown>).chatgpt_account_id;
  return typeof id === "string" && id.trim() ? id.trim() : undefined;
}

/** ChatGPT OAuth refresh that does not load Pi's Node-only OAuth module. */
export async function refreshOpenAiCodexOAuth(
  credential: OAuthCredential,
  signal: AbortSignal,
  fetchFn: typeof fetch = fetch,
): Promise<OAuthCredential> {
  let response: Response;
  try {
    response = await fetchFn(CODEX_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credential.refresh,
        client_id: CODEX_CLIENT_ID,
      }),
      signal,
    });
  } catch (error) {
    throw new Error(
      `OpenAI Codex token refresh error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `OpenAI Codex token refresh failed (${response.status}): ${
        text || response.statusText
      }`,
    );
  }
  const json = (await response.json()) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
  };
  if (
    typeof json.access_token !== "string" ||
    typeof json.expires_in !== "number"
  ) {
    throw new Error(
      `OpenAI Codex token refresh response missing fields: ${JSON.stringify(json)}`,
    );
  }
  const accountId =
    accountIdFromAccess(json.access_token) ??
    (typeof credential.accountId === "string"
      ? credential.accountId
      : undefined);
  if (!accountId) {
    throw new Error("Failed to extract accountId from token");
  }
  return {
    type: "oauth",
    access: json.access_token,
    refresh:
      typeof json.refresh_token === "string" && json.refresh_token
        ? json.refresh_token
        : credential.refresh,
    expires: Date.now() + json.expires_in * 1000,
    accountId,
  };
}

function workerSafeCodexOAuth(fetchFn?: typeof fetch): OAuthAuth {
  return {
    name: "OpenAI (ChatGPT Plus/Pro)",
    isSubscription: true,
    async login() {
      throw new Error(
        "Paste ~/.codex/auth.json in Settings → Models. Browser login is not available on the server.",
      );
    },
    refresh: (credential, signal) =>
      refreshOpenAiCodexOAuth(credential, signal, fetchFn ?? fetch),
    async toAuth(credential) {
      return { apiKey: credential.access };
    },
  };
}

function groxbotCodexProvider(fetchFn?: typeof fetch) {
  const stock = openaiCodexProvider();
  return createProvider({
    id: stock.id,
    name: stock.name,
    baseUrl: stock.baseUrl,
    auth: { oauth: workerSafeCodexOAuth(fetchFn) },
    models: stock.getModels(),
    api: openAICodexResponsesApi(),
  });
}

function toOAuthCredential(auth: OpenAiCodexAuth): OAuthCredential {
  return {
    type: "oauth",
    access: auth.access,
    refresh: auth.refresh,
    expires: auth.expires,
    ...(auth.accountId ? { accountId: auth.accountId } : {}),
  };
}

function fromOAuthCredential(credential: OAuthCredential): OpenAiCodexAuth {
  const accountId =
    typeof credential.accountId === "string" ? credential.accountId : undefined;
  return {
    type: "oauth",
    access: credential.access,
    refresh: credential.refresh,
    expires: credential.expires,
    accountId,
  };
}

class OpenAiCodexCredentialStore implements CredentialStore {
  private value: OAuthCredential;
  private chain = Promise.resolve();

  constructor(
    initial: OpenAiCodexAuth,
    private readonly onChange?: (auth: OpenAiCodexAuth) => Promise<void>,
  ) {
    this.value = toOAuthCredential(initial);
  }

  async read(providerId: string): Promise<Credential | undefined> {
    return providerId === CODEX_PROVIDER ? this.value : undefined;
  }

  async list(): Promise<CredentialInfo[]> {
    return [{ providerId: CODEX_PROVIDER, type: "oauth" }];
  }

  async modify(
    providerId: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined> {
    if (providerId !== CODEX_PROVIDER) return undefined;
    const run = this.chain.then(async () => {
      const next = await fn(this.value);
      if (!next) return this.value;
      if (next.type !== "oauth") return this.value;
      const previous = packOpenAiCodexAuth(fromOAuthCredential(this.value));
      this.value = next;
      const packed = packOpenAiCodexAuth(fromOAuthCredential(next));
      if (packed !== previous && this.onChange) {
        try {
          await this.onChange(fromOAuthCredential(next));
        } catch {
          // Next turn reloads from the previous secret; refresh can retry.
        }
      }
      return this.value;
    });
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async delete(providerId: string): Promise<void> {
    if (providerId !== CODEX_PROVIDER) return;
    await this.modify(providerId, async () => undefined);
  }
}

function errorCodexStream(
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

export function createCodexStreamFn(options: {
  auth: OpenAiCodexAuth;
  persist?: (auth: OpenAiCodexAuth) => Promise<void>;
  fetch?: typeof fetch;
}): StreamFn {
  const store = new OpenAiCodexCredentialStore(options.auth, options.persist);
  const models = createModels({ credentials: store });
  models.setProvider(groxbotCodexProvider(options.fetch));
  return (model, context, streamOptions) => {
    try {
      const piModel = resolvePiAiCodexModel(model.id);
      return models.streamSimple(piModel, withAssistantUsage(context), {
        ...streamOptions,
        fetch: options.fetch,
        maxRetries: streamOptions?.maxRetries ?? 0,
      });
    } catch (error) {
      return errorCodexStream(
        model,
        error instanceof Error ? error.message : "ChatGPT / Codex failed",
      );
    }
  };
}

export function missingCodexStreamFn(): StreamFn {
  return (model) =>
    errorCodexStream(
      model,
      "ChatGPT / Codex is not connected. Paste ~/.codex/auth.json in Settings → Models.",
    );
}
