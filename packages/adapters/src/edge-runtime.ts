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

export {
  createHostedAgentRuntime,
  DEFAULT_AGENT_RUNTIME,
  GatewayAgentRuntime,
  isOfflineAgentRuntime,
  OFFLINE_AGENT_RUNTIME,
  parsePokePrompt,
  resolveAgentRuntimeKind,
  ScriptedAgentRuntime,
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
  overlay: { env: NodeJS.ProcessEnv; model: string },
  fetchImpl?: typeof fetch,
): AgentRuntime {
  return createEdgeAgentRuntime(
    resolveAgentRuntimeKind(kind),
    overlay.env,
    fetchImpl,
  );
}
