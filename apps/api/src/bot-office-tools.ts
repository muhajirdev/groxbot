/** Cloudflare-only. Computer AI SDK tools → Pi AgentTools. Drain generators. */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { openObjectParameters } from "@groxbot/adapters/edge";
import { jsonClone, resolveAiSdkToolResult, stringifyToolOutput } from "@groxbot/core";
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

export function officeAgentTool(opts: {
  name: string;
  description: string;
  parameters: z.ZodType;
  execute: (
    params: Record<string, unknown>,
    ctx: { toolCallId: string; signal?: AbortSignal },
  ) => Promise<unknown>;
}): AgentTool {
  return {
    name: opts.name,
    label: opts.name,
    description: opts.description,
    parameters: jsonSchemaFrom(opts.parameters) ?? openObjectParameters(),
    prepareArguments: objectArgs,
    execute: async (toolCallId, params, signal) => {
      const result = jsonClone(
        await opts.execute(objectArgs(params), { toolCallId, signal }),
      );
      return {
        content: [{ type: "text", text: stringifyToolOutput(result) }],
        details: result,
      };
    },
  };
}

/** Wrap `@cloudflare/computer/tools` `createAITools` (and Code Mode `runtime.tool()`). */
export function aiToolsToPi(tools: Record<string, unknown>): AgentTool[] {
  const out: AgentTool[] = [];
  for (const [name, raw] of Object.entries(tools)) {
    const wrapped = aiToolToPi(name, raw);
    if (wrapped) out.push(wrapped);
  }
  return out;
}

export function aiToolToPi(name: string, raw: unknown): AgentTool | null {
  if (!raw || typeof raw !== "object") return null;
  const tool = raw as AiTool;
  if (typeof tool.execute !== "function") return null;
  const execute = tool.execute;
  return {
    name,
    label: name,
    description:
      typeof tool.description === "string" && tool.description
        ? tool.description
        : name,
    parameters: jsonSchemaParameters(tool),
    prepareArguments: objectArgs,
    execute: async (toolCallId, params, signal) => {
      const result = await resolveAiSdkToolResult(
        execute(params, {
          toolCallId,
          abortSignal: signal,
        }),
        signal,
      );
      return {
        content: [{ type: "text", text: stringifyToolOutput(result) }],
        details: result,
      };
    },
  };
}

function objectArgs(args: unknown): Record<string, unknown> {
  return args && typeof args === "object" && !Array.isArray(args)
    ? (args as Record<string, unknown>)
    : {};
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
  };
  if (record.jsonSchema && typeof record.jsonSchema === "object") {
    return record.jsonSchema as Record<string, unknown>;
  }
  try {
    const json = z.toJSONSchema(schema as z.ZodType);
    if (json && typeof json === "object") {
      return json as Record<string, unknown>;
    }
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
