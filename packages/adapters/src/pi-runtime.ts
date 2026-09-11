import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  AdapterContext,
  AgentRunRequest,
  AgentRuntime,
  AgentRuntimeEvent,
} from "@groxbot/adapter-kit";
import { ownedPiTurnFromRun } from "@groxbot/adapter-kit";
import {
  isNativeCompatProvider,
  OPENROUTER_PROVIDER,
  providerForModel,
} from "@groxbot/contracts";
import {
  type GatewayConfig,
  gatewayConfigured,
  loadGatewayConfig,
} from "./gateway.js";
import { resolvePiAiModel } from "./pi-ai-stream.js";
import {
  createGatewayStreamFn,
  resolveOfficePiModel,
  resolvePiStreamFn,
  runOwnedPiTurn,
  type StreamFn,
} from "./pi-turn.js";

export class PiAgentRuntime implements AgentRuntime {
  private running = new Map<string, AbortController>();

  constructor(
    private readonly config: GatewayConfig,
    private readonly streamFn?: StreamFn,
    private readonly resolveModel?: (modelId: string) => Model<Api>,
  ) {}

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
    const turn = ownedPiTurnFromRun(request);
    const modelId = request.model?.trim() || this.config.model;
    const model = this.resolveModel
      ? this.resolveModel(modelId)
      : resolvePiAiModel(this.config, modelId);
    const streamFn =
      this.streamFn ??
      createGatewayStreamFn(this.config, {
        workspaceId: context.workspaceId,
        userId: context.userId,
        botId: context.botId ?? request.botId,
        runId: context.runId ?? request.runId,
      });
    try {
      let streamed = "";
      const result = await runOwnedPiTurn({
        ...turn,
        model,
        streamFn,
        signal,
        onEvent: (event) => {
          if (event.type !== "message_update") return;
          const update = event.assistantMessageEvent;
          if (update.type !== "text_delta") return;
          streamed += update.delta;
        },
      });
      if (result.stopReason === "aborted" || signal.aborted) {
        yield { type: "done", text: result.text || streamed || "stopped" };
        return;
      }
      if (result.stopReason === "error") {
        yield {
          type: "error",
          text: result.errorMessage || "AI gateway failed",
        };
        return;
      }
      const text = result.text.trim() || streamed.trim();
      if (!text) {
        yield { type: "error", text: "AI gateway returned an empty reply" };
        return;
      }
      yield { type: "text", text };
      if (result.usage) {
        yield {
          type: "usage",
          promptTokens: result.usage.input,
          completionTokens: result.usage.output,
          totalTokens: result.usage.totalTokens,
        };
      }
      yield { type: "done", text };
    } finally {
      this.running.delete(request.runId);
    }
  }
}

function mergeSignals(
  left: AbortSignal | undefined,
  right: AbortSignal,
): AbortSignal {
  if (!left) return right;
  return AbortSignal.any([left, right]);
}

function unusedGatewayConfig(
  source: NodeJS.ProcessEnv,
  modelId: string,
  fetchImpl?: typeof fetch,
): GatewayConfig {
  if (gatewayConfigured(source)) {
    return loadGatewayConfig(source, { fetch: fetchImpl });
  }
  return {
    provider: OPENROUTER_PROVIDER,
    apiKey: "unused",
    model: modelId,
    referer: "",
    title: "Groxbot",
    fetch: fetchImpl ?? fetch,
  };
}

/** Native z.ai / Moonshot BYOK wins over hosted grox-gateway for that catalog id. */
export function nativeCompatAgentRuntime(
  overlay: { env: NodeJS.ProcessEnv; model: string },
  fetchImpl?: typeof fetch,
): PiAgentRuntime | null {
  const modelId = overlay.model.trim();
  if (!isNativeCompatProvider(providerForModel(modelId))) return null;
  const streamFn = resolvePiStreamFn(overlay.env, { modelId });
  if (!streamFn) return null;
  return new PiAgentRuntime(
    unusedGatewayConfig(overlay.env, modelId, fetchImpl),
    streamFn,
    (id) => resolveOfficePiModel(overlay.env, id || modelId),
  );
}
