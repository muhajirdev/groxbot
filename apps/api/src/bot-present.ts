/** Cloudflare-only. Excluded from `tsc`. Glanceable UI in the office thread. */

import { PRESENT_TOOL_DESCRIPTION, runPresent } from "@groxbot/core";
import { tool } from "ai";
import { z } from "zod";

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

export function createPresentTool() {
  return tool({
    description: PRESENT_TOOL_DESCRIPTION,
    inputSchema: presentNode,
    execute: async (input) => runPresent(input),
  });
}
