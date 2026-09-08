/** Cloudflare-only. Excluded from `tsc`. Glanceable UI in the office thread. */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  PRESENT_TOOL_DESCRIPTION,
  PRESENT_TOOL_PARAMETERS,
  runPresent,
} from "@groxbot/core";
import { z } from "zod";
import { officeAgentTool } from "./bot-office-tools.js";

/**
 * Execute stays an open object. A recursive `$type` Zod schema never reached
 * `runPresent`: TypeBox rejected wrapped / aliased trees first, and the
 * model spent minutes retrying the same validation error.
 * Advertise a shallow `$type` schema so the model does not send `{}`.
 */
const presentArgs = z.object({}).passthrough();

export function createPresentTool(): AgentTool {
  const tool = officeAgentTool({
    name: "present",
    description: PRESENT_TOOL_DESCRIPTION,
    parameters: presentArgs,
    execute: async (input) => runPresent(input),
  });
  return {
    ...tool,
    parameters: PRESENT_TOOL_PARAMETERS as AgentTool["parameters"],
  };
}
