/** Cloudflare-only. Procedural memory — office SKILL.md, not this computer. */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  type KnowledgeDisk,
  runOfficeSkill,
  SKILL_TOOL_DESCRIPTION,
  SKILL_TOOL_NAME,
} from "@groxbot/core";
import { z } from "zod";
import { officeAgentTool } from "./bot-office-tools.js";

export function createSkillTool(opts: {
  disk: KnowledgeDisk;
  workspaceId: () => string;
}): AgentTool {
  return officeAgentTool({
    name: SKILL_TOOL_NAME,
    description: SKILL_TOOL_DESCRIPTION,
    parameters: z.object({
      action: z
        .enum(["create", "patch", "edit", "delete"])
        .describe("create new, patch unique snippet, edit full rewrite, delete."),
      name: z
        .string()
        .min(1)
        .describe("Skill slug. Lands at skills/<name>/SKILL.md."),
      content: z
        .string()
        .optional()
        .describe("Full SKILL.md (YAML name + description + body) for create/edit."),
      oldText: z.string().optional().describe("Unique snippet to replace (patch)."),
      newText: z.string().optional().describe("Replacement snippet (patch)."),
    }),
    execute: async (input) =>
      runOfficeSkill(opts.disk, opts.workspaceId(), {
        action: String(input.action ?? ""),
        name: String(input.name ?? ""),
        content: typeof input.content === "string" ? input.content : undefined,
        oldText: typeof input.oldText === "string" ? input.oldText : undefined,
        newText: typeof input.newText === "string" ? input.newText : undefined,
      }),
  });
}
