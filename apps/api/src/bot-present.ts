/** Cloudflare-only. Excluded from `tsc`. Glanceable UI in the office thread. */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import { PRESENT_TOOL_DESCRIPTION, runPresent } from "@groxbot/core";
import { z } from "zod";
import { officeAgentTool } from "./bot-office-tools.js";

const presentNode: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z
    .object({
      $type: z
        .string()
        .min(1)
        .describe("Component name, e.g. Card, Fact, Table, Row, Chart."),
      children: z
        .array(presentNode)
        .optional()
        .describe(
          "Nested components as objects, not a stringified JSON array.",
        ),
    })
    .passthrough(),
);

export function createPresentTool(): AgentTool {
  return officeAgentTool({
    name: "present",
    description: PRESENT_TOOL_DESCRIPTION,
    parameters: presentNode,
    execute: async (input) => runPresent(input),
  });
}
