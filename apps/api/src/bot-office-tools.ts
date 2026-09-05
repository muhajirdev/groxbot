/** Cloudflare-only. Computer AI SDK tools → Pi AgentTools. Drain generators. */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { openObjectParameters } from "@groxbot/adapters/edge";
import {
  executeCodeFromInput,
  isComputerMeterTool,
  jsonClone,
  OFFICE_CODE_TOOL_NAME,
  resolveAiSdkToolResult,
  stringifyToolOutput,
} from "@groxbot/core";
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

const MISSING_EXECUTE_CODE =
  "code needs `code`: JavaScript for the sandbox (knowledge, routines, tools). `command` is the computer shell — use `shell` for bash.";

type OfficeExecuteRaw = {
  description?: string;
  inputSchema?: unknown;
  parameters?: unknown;
  execute: (
    input: unknown,
    options: { toolCallId: string; abortSignal?: AbortSignal },
  ) => Promise<unknown>;
};

/**
 * Code Mode's Standard Schema is `{ code }`. Models still send `command`
 * (computer shell). Coerce before the runtime does `code.length`.
 */
export function bindOfficeExecuteTool(raw: OfficeExecuteRaw): AgentTool {
  const execute = raw.execute.bind(raw);
  const wrapped = aiToolToPi(OFFICE_CODE_TOOL_NAME, {
    ...raw,
    execute: async (
      input: unknown,
      options: { toolCallId: string; abortSignal?: AbortSignal },
    ) => {
      const code = executeCodeFromInput(input);
      if (!code) {
        return {
          status: "error",
          executionId: "",
          error: MISSING_EXECUTE_CODE,
        };
      }
      return execute({ code }, options);
    },
  });
  if (!wrapped) throw new Error("Code Mode code tool is missing execute()");
  return wrapped;
}

export function wrapAgentToolsForComputerUsage(
  tools: AgentTool[],
  onSeconds: (seconds: number) => void,
): AgentTool[] {
  return tools.map((tool) => {
    if (!isComputerMeterTool(tool.name)) return tool;
    const execute = tool.execute.bind(tool);
    return {
      ...tool,
      execute: async (toolCallId, params, signal, onUpdate) => {
        const started = Date.now();
        try {
          return await execute(toolCallId, params, signal, onUpdate);
        } finally {
          const elapsed = Math.max(0, Math.ceil((Date.now() - started) / 1000));
          if (elapsed > 0) onSeconds(elapsed);
        }
      },
    };
  });
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

/** AI SDK / Code Mode Standard Schema → JSON Schema Pi can advertise. */
export function jsonSchemaFrom(schema: object): Record<string, unknown> | null {
  const record = schema as {
    jsonSchema?: unknown;
    "~standard"?: { jsonSchema?: unknown };
  };
  const fromStandard = jsonSchemaFromVendor(record["~standard"]?.jsonSchema);
  if (fromStandard) return fromStandard;
  const fromNested = jsonSchemaFromVendor(record.jsonSchema);
  if (fromNested) return fromNested;
  try {
    const json = z.toJSONSchema(schema as z.ZodType);
    if (isJsonSchemaDocument(json)) return json;
  } catch {
    // Not a Zod schema, or conversion failed.
  }
  try {
    const raw = JSON.parse(JSON.stringify(schema)) as unknown;
    if (isJsonSchemaDocument(raw)) return raw;
  } catch {
    // Symbols / cycles.
  }
  return null;
}

function jsonSchemaFromVendor(jsonSchema: unknown): Record<string, unknown> | null {
  if (!jsonSchema || typeof jsonSchema !== "object" || Array.isArray(jsonSchema)) {
    return null;
  }
  const row = jsonSchema as { input?: unknown };
  if (typeof row.input === "function") {
    try {
      const out = row.input({ target: "draft-07" });
      if (isJsonSchemaDocument(out)) return out;
    } catch {
      // Vendor helper threw.
    }
  }
  return isJsonSchemaDocument(jsonSchema) ? jsonSchema : null;
}

function isJsonSchemaDocument(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as { type?: unknown; properties?: unknown; $ref?: unknown };
  return (
    typeof row.type === "string" ||
    typeof row.$ref === "string" ||
    (row.properties !== undefined &&
      typeof row.properties === "object" &&
      row.properties !== null)
  );
}
