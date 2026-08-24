import type { AgentRunRequest } from "@groxbot/adapter-kit";

export const GATEWAY_PROVIDERS = ["openrouter", "cloudflare"] as const;
export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number];

/** Cloudflare Workers AI — https://developers.cloudflare.com/workers-ai/models/deepseek-v4-flash-0731/ */
export const CLOUDFLARE_DEEPSEEK_V4_FLASH =
  "@cf/deepseek-ai/deepseek-v4-flash-0731";

/** Same DeepSeek V4 Flash release on OpenRouter (Pi catalog id). */
export const OPENROUTER_DEEPSEEK_V4_FLASH = "deepseek/deepseek-v4-flash";

export const OPENROUTER_CHAT_URL =
  "https://openrouter.ai/api/v1/chat/completions";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface GatewayEnv {
  AGENT_RUNTIME?: string;
  AI_GATEWAY_PROVIDER?: string;
  AI_GATEWAY_MODEL?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_API_KEY?: string;
  CLOUDFLARE_AI_GATEWAY_TOKEN?: string;
  CLOUDFLARE_AUTH_TOKEN?: string;
  CLOUDFLARE_AI_GATEWAY_ID?: string;
  CLOUDFLARE_GATEWAY_ID?: string;
  GROXBOT_HOSTED_AI?: string;
  OPENROUTER_API_KEY?: string;
  WEB_ORIGIN?: string;
}

export interface GatewayConfig {
  provider: GatewayProvider;
  apiKey: string;
  model: string;
  accountId?: string;
  gatewayId?: string;
  referer: string;
  title: string;
  fetch: typeof fetch;
}

export function isGatewayProvider(value: string): value is GatewayProvider {
  return (GATEWAY_PROVIDERS as readonly string[]).includes(value);
}

export function defaultGatewayModel(provider: GatewayProvider): string {
  return provider === "cloudflare"
    ? CLOUDFLARE_DEEPSEEK_V4_FLASH
    : OPENROUTER_DEEPSEEK_V4_FLASH;
}

export function cloudflareChatUrl(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
}

export function gatewayChatUrl(config: GatewayConfig): string {
  if (config.provider === "openrouter") return OPENROUTER_CHAT_URL;
  if (!config.accountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required");
  }
  return cloudflareChatUrl(config.accountId);
}

export function gatewayHeaders(
  config: GatewayConfig,
  metadata?: Record<string, string | undefined>,
): Record<string, string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${config.apiKey}`,
    "content-type": "application/json",
  };
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = config.referer;
    headers["X-Title"] = config.title;
    headers["X-OpenRouter-Title"] = config.title;
    return headers;
  }
  headers["cf-aig-gateway-id"] = config.gatewayId ?? "default";
  if (metadata) {
    const packed: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      const trimmed = value?.trim();
      if (trimmed) packed[key] = trimmed;
    }
    if (Object.keys(packed).length > 0) {
      headers["cf-aig-metadata"] = JSON.stringify(packed);
    }
  }
  return headers;
}

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

function asTokenCount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return Math.trunc(parsed);
  }
  return undefined;
}

export function completionUsage(payload: unknown): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} | null {
  const body = unwrapGatewayPayload(payload);
  if (!body || typeof body !== "object") return null;
  const usage = (body as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return null;
  const record = usage as Record<string, unknown>;
  const promptTokens = asTokenCount(
    record.prompt_tokens ?? record.promptTokens,
  );
  const completionTokens = asTokenCount(
    record.completion_tokens ?? record.completionTokens,
  );
  const totalTokens = asTokenCount(record.total_tokens ?? record.totalTokens);
  if (
    promptTokens === undefined &&
    completionTokens === undefined &&
    totalTokens === undefined
  ) {
    return null;
  }
  const prompt = promptTokens ?? 0;
  const completion = completionTokens ?? 0;
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: totalTokens ?? prompt + completion,
  };
}

function read(source: GatewayEnv, key: keyof GatewayEnv): string | undefined {
  const value = source[key]?.trim();
  return value || undefined;
}

function cloudflareGatewayToken(source: GatewayEnv): string | undefined {
  return (
    read(source, "CLOUDFLARE_AI_GATEWAY_TOKEN") ??
    read(source, "CLOUDFLARE_API_TOKEN") ??
    read(source, "CLOUDFLARE_API_KEY") ??
    read(source, "CLOUDFLARE_AUTH_TOKEN")
  );
}

function resolveProvider(
  source: GatewayEnv,
  explicit?: GatewayProvider,
): GatewayProvider {
  if (explicit) return explicit;
  const named = read(source, "AI_GATEWAY_PROVIDER");
  if (named) {
    if (!isGatewayProvider(named)) {
      throw new Error(
        `Unknown AI_GATEWAY_PROVIDER "${named}". Use openrouter or cloudflare.`,
      );
    }
    return named;
  }
  const cloudflareToken = cloudflareGatewayToken(source);
  if (read(source, "CLOUDFLARE_ACCOUNT_ID") && cloudflareToken) {
    return "cloudflare";
  }
  if (read(source, "OPENROUTER_API_KEY")) return "openrouter";
  throw new Error(
    "AI gateway is not configured. Set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN, or OPENROUTER_API_KEY.",
  );
}

export function loadGatewayConfig(
  source: GatewayEnv = process.env,
  options: { provider?: GatewayProvider; fetch?: typeof fetch } = {},
): GatewayConfig {
  const provider = resolveProvider(source, options.provider);
  const model =
    read(source, "AI_GATEWAY_MODEL") ?? defaultGatewayModel(provider);
  const referer = read(source, "WEB_ORIGIN") ?? "https://groxbot.com";
  if (provider === "cloudflare") {
    const accountId = read(source, "CLOUDFLARE_ACCOUNT_ID");
    const apiKey = cloudflareGatewayToken(source);
    if (!accountId || !apiKey) {
      throw new Error(
        "Cloudflare AI Gateway needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.",
      );
    }
    return {
      provider,
      apiKey,
      model,
      accountId,
      gatewayId:
        read(source, "CLOUDFLARE_AI_GATEWAY_ID") ??
        read(source, "CLOUDFLARE_GATEWAY_ID") ??
        "default",
      referer,
      title: "Groxbot",
      fetch: options.fetch ?? fetch,
    };
  }
  const apiKey = read(source, "OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new Error("OpenRouter AI Gateway needs OPENROUTER_API_KEY.");
  }
  return {
    provider,
    apiKey,
    model,
    referer,
    title: "Groxbot",
    fetch: options.fetch ?? fetch,
  };
}

export function gatewayConfigured(source: GatewayEnv = process.env): boolean {
  try {
    loadGatewayConfig(source);
    return true;
  } catch {
    return false;
  }
}

export function chatMessages(request: AgentRunRequest): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const instructions = request.instructions.trim();
  if (instructions) {
    messages.push({ role: "system", content: instructions });
  }
  for (const item of request.history) {
    const content = item.content.trim();
    if (!content) continue;
    messages.push({ role: item.role, content });
  }
  const prompt = request.prompt.trim();
  const last = messages.at(-1);
  if (prompt && (last?.role !== "user" || last.content !== prompt)) {
    messages.push({ role: "user", content: prompt });
  }
  if (messages.length === 0) {
    messages.push({ role: "user", content: prompt || "Hello" });
  }
  return messages;
}

export function unwrapGatewayPayload(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (record.result && typeof record.result === "object") return record.result;
  return value;
}

function textFromPart(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.content === "string") return record.content;
  if (typeof record.text === "string") return record.text;
  if (typeof record.response === "string") return record.response;
  return "";
}

export function deltaText(payload: unknown): string {
  const body = unwrapGatewayPayload(payload);
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  const choices = record.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const choice = choices[0] as Record<string, unknown>;
    const fromDelta = textFromPart(choice.delta);
    if (fromDelta) return fromDelta;
    const fromMessage = textFromPart(choice.message);
    if (fromMessage) return fromMessage;
    if (typeof choice.text === "string") return choice.text;
  }
  return textFromPart(record);
}

export function gatewayErrorMessage(status: number, body: string): string {
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    if (typeof json.error === "string" && json.error.trim()) return json.error;
    if (json.error && typeof json.error === "object") {
      const message = (json.error as Record<string, unknown>).message;
      if (typeof message === "string" && message.trim()) return message;
    }
    if (Array.isArray(json.errors)) {
      const first = json.errors[0];
      if (first && typeof first === "object") {
        const message = (first as Record<string, unknown>).message;
        if (typeof message === "string" && message.trim()) return message;
      }
    }
    if (typeof json.message === "string" && json.message.trim()) {
      return json.message;
    }
  } catch {
    // raw body
  }
  const trimmed = body.trim();
  if (trimmed) return trimmed.slice(0, 400);
  return `AI gateway HTTP ${status}`;
}

export async function* readSseData(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data) continue;
        if (data === "[DONE]") return;
        yield data;
      }
    }
    const tail = buffer.trim();
    if (tail.startsWith("data:")) {
      const data = tail.slice(5).trim();
      if (data && data !== "[DONE]") yield data;
    }
  } finally {
    reader.releaseLock();
  }
}
