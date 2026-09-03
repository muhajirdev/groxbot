import type { AgentRuntime } from "@groxbot/adapter-kit";
import { DEFAULT_AI_GATEWAY_ID } from "@groxbot/contracts";
import type { GatewayEnv } from "./gateway.js";
import { PiAgentRuntime } from "./pi-runtime.js";
import {
  createHostedAgentRuntime,
  GatewayAgentRuntime,
  parsePokePrompt,
  resolveAgentRuntimeKind,
  ScriptedAgentRuntime,
} from "./runtime-core.js";
import { type WorkersAiBinding, WorkersAiRuntime } from "./workers-ai.js";

export type { WorkersAiBinding };
export {
  createHostedAgentRuntime,
  GatewayAgentRuntime,
  parsePokePrompt,
  PiAgentRuntime,
  resolveAgentRuntimeKind,
  ScriptedAgentRuntime,
  WorkersAiRuntime,
};

export function createEdgeAgentRuntime(
  source: GatewayEnv | NodeJS.ProcessEnv = {},
  fetchImpl?: typeof fetch,
): AgentRuntime {
  return createHostedAgentRuntime(source, { fetch: fetchImpl });
}

export function bindEdgeAgentRuntime(
  overlay: { env: NodeJS.ProcessEnv; model: string; hosted?: boolean },
  options?: { fetch?: typeof fetch; ai?: WorkersAiBinding },
): AgentRuntime {
  if (overlay.hosted && options?.ai) {
    return new WorkersAiRuntime({
      ai: options.ai,
      model: overlay.model,
      gatewayId:
        overlay.env.CLOUDFLARE_AI_GATEWAY_ID?.trim() || DEFAULT_AI_GATEWAY_ID,
    });
  }
  return createHostedAgentRuntime(overlay.env, {
    fetch: options?.fetch,
  });
}
