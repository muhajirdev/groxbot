import type { AgentTool } from "@earendil-works/pi-agent-core";

export function openObjectParameters(): AgentTool["parameters"] {
  return {
    type: "object",
    additionalProperties: true,
  } as AgentTool["parameters"];
}
