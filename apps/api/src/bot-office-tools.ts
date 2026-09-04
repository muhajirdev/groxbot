/** Cloudflare-only. Convert office AI SDK tools into Pi AgentTools. */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { openObjectParameters } from "@groxbot/adapters/edge";
import { stringifyToolOutput } from "@groxbot/core";
import type { ToolSet } from "ai";
import { z } from "zod";

type AiTool = {
  description?: string;
  inputSchema?: unknown;
  parameters?: unknown;
  execute?: (
    input: unknown,
    options: { toolCallId: string; abortSignal?: AbortSignal },
  ) => Promise<unknown>;
};

export function aiToolsToPi(tools: ToolSet): AgentTool[] {
  const out: AgentTool[] = [];
  for (const [name, raw] of Object.entries(tools)) {
    if (!raw || typeof raw !== "object") continue;
    const tool = raw as AiTool;
    if (typeof tool.execute !== "function") continue;
    const execute = tool.execute;
    out.push({
      name,
      label: name,
      description:
        typeof tool.description === "string" && tool.description
          ? tool.description
          : name,
      parameters: jsonSchemaParameters(tool),
      prepareArguments: (args: unknown) =>
        args && typeof args === "object" && !Array.isArray(args)
          ? (args as Record<string, unknown>)
          : {},
      execute: async (toolCallId, params, signal) => {
        const result = await execute(params, {
          toolCallId,
          abortSignal: signal,
        });
        return {
          content: [{ type: "text", text: stringifyToolOutput(result) }],
          details: result,
        };
      },
    });
  }
  return out;
}

function jsonSchemaParameters(tool: AiTool): AgentTool["parameters"] {
  const schema = tool.inputSchema ?? tool.parameters;
  if (schema && typeof schema === "object") {
    const json = jsonSchemaFrom(schema);
    if (json) return json as AgentTool["parameters"];
  }
  return openObjectParameters();
}

function jsonSchemaFrom(schema: object): Record<string, unknown> | null {
  const record = schema as {
    jsonSchema?: unknown;
    "~standard"?: unknown;
  };
  if (record.jsonSchema && typeof record.jsonSchema === "object") {
    return record.jsonSchema as Record<string, unknown>;
  }
  try {
    const json = z.toJSONSchema(schema as z.ZodType);
    if (json && typeof json === "object")
      return json as Record<string, unknown>;
  } catch {
    // Not a Zod schema, or conversion failed.
  }
  try {
    const raw = JSON.parse(JSON.stringify(schema)) as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
  } catch {
    // Symbols / cycles.
  }
  return null;
}
