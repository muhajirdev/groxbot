/** Cloudflare-only. Excluded from `tsc`. Glanceable UI in the office thread. */

import { PRESENT_TOOL_DESCRIPTION, runPresent } from "@groxbot/core";
import { tool } from "ai";
import { z } from "zod";

export function createPresentTool() {
  return tool({
    description: PRESENT_TOOL_DESCRIPTION,
    inputSchema: z
      .object({
        $type: z
          .string()
          .min(1)
          .describe("Component name, e.g. Card, Fact, Table, Row, Chart."),
      })
      .passthrough(),
    execute: async (input) => runPresent(input),
  });
}
