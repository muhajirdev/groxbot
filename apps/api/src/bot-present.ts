/** Cloudflare-only. Excluded from `tsc`. Glanceable UI in the office thread. */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import { PRESENT_TOOL_DESCRIPTION, runPresent } from "@groxbot/core";
import { z } from "zod";
import { officeAgentTool } from "./bot-office-tools.js";

/**
 * Open object on purpose. A recursive `$type` Zod schema never reached
 * `runPresent`: TypeBox rejected wrapped / aliased trees first, and the
 * model spent minutes retrying the same validation error.
 */
const presentArgs = z.object({}).passthrough();

export function createPresentTool(): AgentTool {
  return officeAgentTool({
    name: "present",
    description: PRESENT_TOOL_DESCRIPTION,
    parameters: presentArgs,
    execute: async (input) => runPresent(input),
  });
}
