import type { AgentRuntime } from "@groxbot/adapter-kit";
import { hostedAiEnabled, PRODUCT_RUNTIME } from "@groxbot/contracts";
import {
  type GatewayEnv,
  gatewayConfigured,
  isGatewayProvider,
  loadGatewayConfig,
} from "./gateway.js";
import { GatewayAgentRuntime } from "./runtime-core.js";

export {
  createHostedAgentRuntime,
  GatewayAgentRuntime,
  parsePokePrompt,
  resolveAgentRuntimeKind,
  ScriptedAgentRuntime,
} from "./runtime-core.js";

import {
  createHostedAgentRuntime,
  resolveAgentRuntimeKind,
} from "./runtime-core.js";

export function bindAgentRuntime(
  overlay: { env: NodeJS.ProcessEnv; model: string; hosted?: boolean },
  fetchImpl?: typeof fetch,
): AgentRuntime {
  return createHostedAgentRuntime(overlay.env, { fetch: fetchImpl });
}

export function agentRuntimeNeedsModel(
  kind: string | undefined,
  source: GatewayEnv | NodeJS.ProcessEnv = process.env,
): boolean {
  const runtime = resolveAgentRuntimeKind(kind);
  if (hostedAiEnabled(source)) return false;
  if (runtime === PRODUCT_RUNTIME || isGatewayProvider(runtime)) {
    return !gatewayConfigured(source);
  }
  return true;
}

export function createAgentRuntime(
  kind: string = PRODUCT_RUNTIME,
  source: GatewayEnv | NodeJS.ProcessEnv = process.env,
  fetchImpl?: typeof fetch,
): AgentRuntime {
  const runtime = kind.trim() || PRODUCT_RUNTIME;
  if (runtime === PRODUCT_RUNTIME) {
    return createHostedAgentRuntime(source, { fetch: fetchImpl });
  }
  if (isGatewayProvider(runtime)) {
    return new GatewayAgentRuntime(
      loadGatewayConfig(source, { provider: runtime, fetch: fetchImpl }),
    );
  }
  throw new Error(
    `Unknown agent runtime "${kind}". Product brain is ${PRODUCT_RUNTIME}. Tests construct ScriptedAgentRuntime.`,
  );
}
