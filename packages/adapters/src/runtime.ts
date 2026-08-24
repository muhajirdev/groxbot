import type { AgentRuntime } from "@groxbot/adapter-kit";
import { hostedAiEnabled, PRODUCT_RUNTIME } from "@groxbot/contracts";
import { flueConfigured, getFlueAgentRuntime } from "./flue/runtime.js";
import {
  type GatewayEnv,
  gatewayConfigured,
  isGatewayProvider,
  loadGatewayConfig,
} from "./gateway.js";
import { GatewayAgentRuntime } from "./runtime-core.js";

export {
  createHostedAgentRuntime,
  FLUE_ECHO_RUNTIME,
  FLUE_RUNTIME,
  GatewayAgentRuntime,
  isOfflineAgentRuntime,
  parsePokePrompt,
  resolveAgentRuntimeKind,
  ScriptedAgentRuntime,
} from "./runtime-core.js";

import {
  createHostedAgentRuntime,
  FLUE_ECHO_RUNTIME,
  FLUE_RUNTIME,
  isOfflineAgentRuntime,
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
  if (isOfflineAgentRuntime(runtime)) return false;
  if (runtime === FLUE_RUNTIME) {
    return !flueConfigured(source as NodeJS.ProcessEnv);
  }
  if (hostedAiEnabled(source)) return false;
  return !gatewayConfigured(source);
}

export function createAgentRuntime(
  kind = PRODUCT_RUNTIME,
  source: GatewayEnv | NodeJS.ProcessEnv = process.env,
  fetchImpl?: typeof fetch,
): AgentRuntime {
  const runtime = kind.trim() || PRODUCT_RUNTIME;
  if (runtime === FLUE_RUNTIME || runtime === FLUE_ECHO_RUNTIME) {
    return getFlueAgentRuntime(runtime === FLUE_ECHO_RUNTIME, {
      ...process.env,
      ...(source as NodeJS.ProcessEnv),
    });
  }
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
