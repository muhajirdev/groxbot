/** Cloudflare-only. Excluded from `tsc`. Office library tools on R2. */
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import {
  listKnowledge,
  readKnowledge,
  writeKnowledge,
  type KnowledgeDisk,
} from "@groxbot/core";

export function createKnowledgeTools(opts: {
  disk: KnowledgeDisk;
  workspaceId: string;
}): ToolSet {
  const { disk, workspaceId } = opts;
  return {
    save_office_knowledge: tool({
      description:
        "Save a file to the office knowledge base so every teammate can use it. Not this computer. Path is yours (skills/weekly-update/SKILL.md, how-we-work/constraints.md, brief.pdf). A folder with SKILL.md (YAML name + description) is a reusable playbook — prefer skills/<name>/. Link other office files with [label](path/from/office/root.md) — not ../, not [[wikilinks]].",
      inputSchema: z.object({
        path: z.string().min(1).max(240),
        content: z.string().min(1).max(64_000),
      }),
      execute: async (input) => {
        const saved = await writeKnowledge(disk, workspaceId, {
          path: input.path,
          content: input.content,
        });
        return { path: saved.path };
      },
    }),
    read_office_knowledge: tool({
      description:
        "Read a file from the office knowledge base. Path is the full path, e.g. skills/weekly-update/SKILL.md.",
      inputSchema: z.object({
        path: z.string().min(1).max(240),
      }),
      execute: async (input) => {
        const file = await readKnowledge(disk, workspaceId, input.path);
        return {
          path: file.path,
          title: file.title,
          description: file.description,
          content: file.content,
          encoding: file.encoding,
        };
      },
    }),
    list_office_knowledge: tool({
      description:
        "List files in this office’s knowledge base. Use the returned paths in markdown links.",
      inputSchema: z.object({}),
      execute: async () => {
        const listed = await listKnowledge(disk, workspaceId);
        return listed.entries.map((row) => ({
          path: row.path,
          title: row.title,
          description: row.description,
        }));
      },
    }),
  };
}
