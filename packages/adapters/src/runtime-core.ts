import type {
  AdapterContext,
  AgentRunRequest,
  AgentRuntime,
  AgentRuntimeEvent,
} from "@groxbot/adapter-kit";
import {
  chatMessages,
  completionUsage,
  deltaText,
  type GatewayConfig,
  type GatewayEnv,
  gatewayChatUrl,
  gatewayConfigured,
  gatewayErrorMessage,
  gatewayHeaders,
  gatewayRequestModel,
  loadGatewayConfig,
  readSseData,
  unwrapGatewayPayload,
} from "./gateway.js";

export class ScriptedAgentRuntime implements AgentRuntime {
  private running = new Map<string, AbortController>();

  async abort(runId: string): Promise<void> {
    this.running.get(runId)?.abort();
  }

  async *run(
    request: AgentRunRequest,
    context: AdapterContext,
  ): AsyncIterable<AgentRuntimeEvent> {
    const controller = new AbortController();
    this.running.set(request.runId, controller);
    const signal = mergeSignals(context.signal, controller.signal);
    yield { type: "progress", text: "working…" };
    await new Promise((resolve) => setTimeout(resolve, 450));
    if (signal.aborted) {
      yield { type: "done", text: "stopped" };
      this.running.delete(request.runId);
      return;
    }
    const poke = parsePokePrompt(request.prompt);
    if (poke && request.pokeTeammate) {
      try {
        const reply = await request.pokeTeammate(poke);
        const text = `Asked ${poke.name}. They said: ${reply}`;
        yield { type: "text", text };
        yield { type: "done", text };
      } catch (error) {
        const text = error instanceof Error ? error.message : "Poke failed.";
        yield { type: "text", text };
        yield { type: "done", text };
      }
      this.running.delete(request.runId);
      return;
    }
    const reply = `Echo: ${request.prompt}`;
    yield { type: "text", text: reply };
    yield { type: "done", text: reply };
    this.running.delete(request.runId);
  }
}

export class GatewayAgentRuntime implements AgentRuntime {
  private running = new Map<string, AbortController>();

  constructor(private readonly config: GatewayConfig) {}

  async abort(runId: string): Promise<void> {
    this.running.get(runId)?.abort();
  }

  async *run(
    request: AgentRunRequest,
    context: AdapterContext,
  ): AsyncIterable<AgentRuntimeEvent> {
    const controller = new AbortController();
    this.running.set(request.runId, controller);
    const signal = mergeSignals(context.signal, controller.signal);
    yield { type: "progress", text: "working…" };
    let reply = "";
    let usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    } | null = null;
    try {
      const response = await this.config.fetch(gatewayChatUrl(this.config), {
        method: "POST",
        headers: gatewayHeaders(this.config, {
          workspaceId: context.workspaceId,
          userId: context.userId,
          botId: context.botId ?? request.botId,
          runId: context.runId ?? request.runId,
        }),
        body: JSON.stringify({
          model: gatewayRequestModel(
            request.model?.trim() || this.config.model,
          ),
          stream: true,
          stream_options: { include_usage: true },
          messages: chatMessages(request),
        }),
        signal,
      });
      const raw = await readResponseBody(response);
      if (!response.ok) {
        const text =
          raw.text || (raw.stream ? await new Response(raw.stream).text() : "");
        throw new Error(gatewayErrorMessage(response.status, text));
      }
      if (raw.stream) {
        for await (const data of readSseData(raw.stream, signal)) {
          if (signal.aborted) break;
          let payload: unknown;
          try {
            payload = JSON.parse(data) as unknown;
          } catch {
            continue;
          }
          usage = completionUsage(payload) ?? usage;
          const chunk = deltaText(payload);
          if (!chunk) continue;
          reply += chunk;
          yield { type: "progress", text: reply };
        }
      } else {
        try {
          const payload = JSON.parse(raw.text) as unknown;
          usage = completionUsage(payload);
          reply = completionText(raw.text);
        } catch {
          reply = completionText(raw.text);
        }
      }
      if (signal.aborted) {
        yield { type: "done", text: reply || "stopped" };
        return;
      }
      if (!reply.trim()) {
        throw new Error("AI gateway returned an empty reply");
      }
      yield { type: "text", text: reply };
      if (usage) yield { type: "usage", ...usage };
      yield { type: "done", text: reply };
    } catch (error) {
      if (isAbortError(error) || signal.aborted) {
        yield { type: "done", text: reply || "stopped" };
        return;
      }
      const message =
        error instanceof Error ? error.message : "AI gateway failed";
      yield { type: "error", text: message };
    } finally {
      this.running.delete(request.runId);
    }
  }
}

function completionText(body: string): string {
  try {
    const payload = unwrapGatewayPayload(JSON.parse(body) as unknown);
    return deltaText(payload).trim();
  } catch {
    return body.trim();
  }
}

async function readResponseBody(response: Response): Promise<{
  text: string;
  stream?: ReadableStream<Uint8Array>;
}> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("event-stream") && response.body) {
    return { text: "", stream: response.body };
  }
  const text = await response.text();
  if (looksLikeSse(text)) {
    return { text, stream: encodedStream(text) };
  }
  return { text };
}

function looksLikeSse(text: string): boolean {
  return /^\s*data:/m.test(text) || text.includes("data: [DONE]");
}

function encodedStream(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function mergeSignals(
  left: AbortSignal | undefined,
  right: AbortSignal,
): AbortSignal {
  if (!left) return right;
  return AbortSignal.any([left, right]);
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError")
  );
}

/** `poke Lookout: do the thing` — test/offline only. Live Flue uses poke_teammate. */
export function parsePokePrompt(
  prompt: string,
): { name: string; message: string } | null {
  const match = prompt.trim().match(/^poke\s+(\S+):\s*([\s\S]+)/i);
  if (!match?.[1] || !match[2]?.trim()) return null;
  return { name: match[1], message: match[2].trim() };
}

/** Product default on the Worker: AI Gateway chat completions. */
export const DEFAULT_AGENT_RUNTIME = "gateway";

/** Offline stub for tests and CI. */
export const OFFLINE_AGENT_RUNTIME = "scripted";

export function resolveAgentRuntimeKind(kind?: string | null): string {
  const runtime = kind?.trim();
  return runtime || DEFAULT_AGENT_RUNTIME;
}

export function isOfflineAgentRuntime(kind: string): boolean {
  return kind === "scripted" || kind === "flue-echo";
}

/**
 * Hosted Worker brain: Gateway when keys exist, else scripted echo.
 * Call this from the Worker entry instead of a kind string.
 */
export function createHostedAgentRuntime(
  source: GatewayEnv | NodeJS.ProcessEnv = {},
  fetchImpl?: typeof fetch,
): AgentRuntime {
  if (!gatewayConfigured(source)) return new ScriptedAgentRuntime();
  return new GatewayAgentRuntime(
    loadGatewayConfig(source, { fetch: fetchImpl }),
  );
}

/**
 * Worker-safe runtimes: scripted echo, or chat-completions gateway.
 * Prefer `createHostedAgentRuntime` at product call sites.
 */
export function createScriptedOrGatewayRuntime(
  kind = OFFLINE_AGENT_RUNTIME,
  source: GatewayEnv | NodeJS.ProcessEnv = {},
  fetchImpl?: typeof fetch,
): AgentRuntime {
  const runtime = resolveAgentRuntimeKind(kind);
  if (runtime === "scripted" || runtime === "flue-echo") {
    return new ScriptedAgentRuntime();
  }
  if (
    runtime === "flue" ||
    runtime === "gateway" ||
    runtime === "openrouter" ||
    runtime === "cloudflare"
  ) {
    return createHostedAgentRuntime(source, fetchImpl);
  }
  throw new Error(
    `Unknown AGENT_RUNTIME "${kind}". Use scripted, gateway, openrouter, or cloudflare.`,
  );
}
