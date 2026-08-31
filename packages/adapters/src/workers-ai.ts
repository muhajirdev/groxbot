import type {
  AdapterContext,
  AgentRunRequest,
  AgentRuntime,
  AgentRuntimeEvent,
} from "@groxbot/adapter-kit";
import { DEFAULT_AI_GATEWAY_ID } from "@groxbot/contracts";
import {
  chatMessages,
  completionUsage,
  deltaText,
  gatewayRequestModel,
  readSseData,
} from "./gateway.js";

export interface WorkersAiGatewayOptions {
  id?: string;
  skipCache?: boolean;
  metadata?: Record<string, string>;
}

/** Duck-typed Workers `env.AI` binding. No `cloudflare:workers` import. */
export interface WorkersAiBinding {
  run(
    model: string,
    input: {
      messages: Array<{ role: string; content: string }>;
      stream?: boolean;
    },
    options?: { gateway?: WorkersAiGatewayOptions },
  ): Promise<unknown>;
}

export interface WorkersAiRuntimeOptions {
  ai: WorkersAiBinding;
  gatewayId?: string;
  model?: string;
}

export class WorkersAiRuntime implements AgentRuntime {
  private running = new Map<string, AbortController>();

  constructor(private readonly options: WorkersAiRuntimeOptions) {}

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
      const model = gatewayRequestModel(
        request.model?.trim() || this.options.model || "",
      );
      if (!model) throw new Error("Hosted Groxbot needs a model id.");
      const result = await this.options.ai.run(
        model,
        { messages: chatMessages(request), stream: true },
        {
          gateway: {
            id: this.options.gatewayId || DEFAULT_AI_GATEWAY_ID,
            metadata: {
              workspaceId: context.workspaceId,
              userId: context.userId,
              botId: context.botId ?? request.botId,
              runId: context.runId ?? request.runId,
            },
          },
        },
      );
      if (signal.aborted) {
        yield { type: "done", text: "stopped" };
        return;
      }
      if (isReadableStream(result)) {
        for await (const data of readSseData(result, signal)) {
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
        usage = completionUsage(result);
        reply = deltaText(result).trim();
      }
      if (signal.aborted) {
        yield { type: "done", text: reply || "stopped" };
        return;
      }
      if (!reply.trim()) {
        throw new Error("The hosted model returned an empty reply");
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
        error instanceof Error ? error.message : "The hosted model failed";
      yield { type: "error", text: message };
    } finally {
      this.running.delete(request.runId);
    }
  }
}

function isReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ReadableStream<Uint8Array>).getReader === "function"
  );
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
