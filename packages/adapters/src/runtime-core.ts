import type {
  AdapterContext,
  AgentRunRequest,
  AgentRuntime,
  AgentRuntimeEvent,
} from "@groxbot/adapter-kit";
import { DEFAULT_AI_GATEWAY_ID, PRODUCT_RUNTIME } from "@groxbot/contracts";
import {
  type GatewayEnv,
  gatewayConfigured,
  loadGatewayConfig,
} from "./gateway.js";
import { PiAgentRuntime } from "./pi-runtime.js";
import { type WorkersAiBinding, WorkersAiRuntime } from "./workers-ai.js";

export { PiAgentRuntime };

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

/** Explicit OpenRouter / Cloudflare REST — same Pi loop as hosted. */
export class GatewayAgentRuntime extends PiAgentRuntime {}

function mergeSignals(
  left: AbortSignal | undefined,
  right: AbortSignal,
): AbortSignal {
  if (!left) return right;
  return AbortSignal.any([left, right]);
}

/** `poke Lookout: do the thing` — test/offline only. */
export function parsePokePrompt(
  prompt: string,
): { name: string; message: string } | null {
  const match = prompt.trim().match(/^poke\s+(\S+):\s*([\s\S]+)/i);
  if (!match?.[1] || !match[2]?.trim()) return null;
  return { name: match[1], message: match[2].trim() };
}

export function resolveAgentRuntimeKind(kind?: string | null): string {
  const runtime = kind?.trim();
  return runtime || PRODUCT_RUNTIME;
}

/**
 * Hosted Worker brain: `env.AI` binding, else REST gateway keys.
 * Tests construct `ScriptedAgentRuntime` instead of selecting a kind.
 */
export function createHostedAgentRuntime(
  source: GatewayEnv | NodeJS.ProcessEnv = {},
  options?: {
    fetch?: typeof fetch;
    ai?: WorkersAiBinding;
    gatewayId?: string;
  },
): AgentRuntime {
  if (options?.ai) {
    return new WorkersAiRuntime({
      ai: options.ai,
      gatewayId:
        options.gatewayId ||
        source.CLOUDFLARE_AI_GATEWAY_ID?.trim() ||
        DEFAULT_AI_GATEWAY_ID,
    });
  }
  if (!gatewayConfigured(source)) {
    throw new Error(
      "Hosted brain needs the Worker AI binding or a Cloudflare/OpenRouter gateway key.",
    );
  }
  return new PiAgentRuntime(
    loadGatewayConfig(source, { fetch: options?.fetch }),
  );
}
