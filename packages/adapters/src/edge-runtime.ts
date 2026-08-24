import type { AgentRuntime } from "@groxbot/adapter-kit";
import type { GatewayEnv } from "./gateway.js";
import {
  createHostedAgentRuntime,
  createScriptedOrGatewayRuntime,
  DEFAULT_AGENT_RUNTIME,
  GatewayAgentRuntime,
  isOfflineAgentRuntime,
  OFFLINE_AGENT_RUNTIME,
  parsePokePrompt,
  resolveAgentRuntimeKind,
  ScriptedAgentRuntime,
} from "./runtime-core.js";
import { type WorkersAiBinding, WorkersAiRuntime } from "./workers-ai.js";

export type { WorkersAiBinding };
export {
  createHostedAgentRuntime,
  DEFAULT_AGENT_RUNTIME,
  GatewayAgentRuntime,
  isOfflineAgentRuntime,
  OFFLINE_AGENT_RUNTIME,
  parsePokePrompt,
  resolveAgentRuntimeKind,
  ScriptedAgentRuntime,
  WorkersAiRuntime,
};

export function createEdgeAgentRuntime(
  kind = OFFLINE_AGENT_RUNTIME,
  source: GatewayEnv | NodeJS.ProcessEnv = {},
  fetchImpl?: typeof fetch,
): AgentRuntime {
  return createScriptedOrGatewayRuntime(kind, source, fetchImpl);
}

export function bindEdgeAgentRuntime(
  kind: string | undefined,
  overlay: { env: NodeJS.ProcessEnv; model: string; hosted?: boolean },
  options?: { fetch?: typeof fetch; ai?: WorkersAiBinding },
): AgentRuntime {
  if (overlay.hosted && options?.ai) {
    return new WorkersAiRuntime({
      ai: options.ai,
      model: overlay.model,
      gatewayId: overlay.env.CLOUDFLARE_AI_GATEWAY_ID || "default",
    });
  }
  return createEdgeAgentRuntime(
    resolveAgentRuntimeKind(kind),
    overlay.env,
    options?.fetch,
  );
}
