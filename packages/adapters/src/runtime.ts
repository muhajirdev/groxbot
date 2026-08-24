import type { AgentRuntime } from "@groxbot/adapter-kit";
import { flueConfigured, getFlueAgentRuntime } from "./flue/runtime.js";
import {
  type GatewayEnv,
  type GatewayProvider,
  gatewayConfigured,
  isGatewayProvider,
  loadGatewayConfig,
} from "./gateway.js";
import { GatewayAgentRuntime } from "./runtime-core.js";

export {
  DEFAULT_AGENT_RUNTIME,
  GatewayAgentRuntime,
  isOfflineAgentRuntime,
  OFFLINE_AGENT_RUNTIME,
  parsePokePrompt,
  resolveAgentRuntimeKind,
  ScriptedAgentRuntime,
} from "./runtime-core.js";

import {
  createScriptedOrGatewayRuntime,
  isOfflineAgentRuntime,
  OFFLINE_AGENT_RUNTIME,
  resolveAgentRuntimeKind,
} from "./runtime-core.js";

export function bindAgentRuntime(
  kind: string | undefined,
  overlay: { env: NodeJS.ProcessEnv; model: string; hosted?: boolean },
  fetchImpl?: typeof fetch,
): AgentRuntime {
  return createAgentRuntime(
    resolveAgentRuntimeKind(kind),
    overlay.env,
    fetchImpl,
  );
}

export function agentRuntimeNeedsModel(
  kind: string,
  source: GatewayEnv | NodeJS.ProcessEnv = process.env,
): boolean {
  const runtime = resolveAgentRuntimeKind(kind);
  if (isOfflineAgentRuntime(runtime)) return false;
  if (runtime === "flue") {
    return !flueConfigured(source as NodeJS.ProcessEnv);
  }
  if (source.GROXBOT_HOSTED_AI?.trim()) return false;
  return !gatewayConfigured(source);
}

export function createAgentRuntime(
  kind = OFFLINE_AGENT_RUNTIME,
  source: GatewayEnv | NodeJS.ProcessEnv = process.env,
  fetchImpl?: typeof fetch,
): AgentRuntime {
  const runtime = kind.trim() || OFFLINE_AGENT_RUNTIME;
  if (runtime === "flue" || runtime === "flue-echo") {
    return getFlueAgentRuntime(runtime === "flue-echo", {
      ...process.env,
      ...(source as NodeJS.ProcessEnv),
    });
  }
  if (
    runtime === "gateway" ||
    runtime === "openrouter" ||
    runtime === "cloudflare"
  ) {
    const provider: GatewayProvider | undefined = isGatewayProvider(runtime)
      ? runtime
      : undefined;
    return new GatewayAgentRuntime(
      loadGatewayConfig(source, { provider, fetch: fetchImpl }),
    );
  }
  return createScriptedOrGatewayRuntime(runtime, source, fetchImpl);
}
