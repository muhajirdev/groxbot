import { describe, expect, it, vi } from "vitest";
import {
  bindOfficeExecuteTool,
  jsonSchemaFrom,
} from "./bot-office-tools.js";

describe("jsonSchemaFrom", () => {
  it("unwraps Code Mode Standard Schema { code }", () => {
    const proxyJsonSchema = {
      type: "object",
      properties: { code: { type: "string" } },
      required: ["code"],
      additionalProperties: false,
    };
    const proxySchema = {
      "~standard": {
        version: 1,
        vendor: "@cloudflare/codemode",
        jsonSchema: {
          input: () => proxyJsonSchema,
          output: () => proxyJsonSchema,
        },
      },
    };
    expect(jsonSchemaFrom(proxySchema)).toEqual(proxyJsonSchema);
  });

  it("does not treat { input, output } helpers as a JSON Schema", () => {
    expect(
      jsonSchemaFrom({
        jsonSchema: {
          input: () => ({ type: "string" }),
          output: () => ({ type: "string" }),
        },
      }),
    ).toEqual({ type: "string" });
  });
});

describe("bindOfficeExecuteTool", () => {
  it("advertises code to Pi instead of an open object", () => {
    const tool = bindOfficeExecuteTool({
      inputSchema: {
        "~standard": {
          jsonSchema: {
            input: () => ({
              type: "object",
              properties: { code: { type: "string" } },
              required: ["code"],
            }),
          },
        },
      },
      execute: async () => ({ ok: true }),
    });
    const schema = tool.parameters as {
      properties?: Record<string, unknown>;
      required?: string[];
    };
    expect(schema.properties).toHaveProperty("code");
    expect(schema.required).toContain("code");
    expect(tool.name).toBe("code");
  });

  it("maps command onto code so Code Mode does not crash on code.length", async () => {
    const execute = vi.fn(async (input: unknown) => input);
    const tool = bindOfficeExecuteTool({
      execute,
    });
    const result = await tool.execute("call_1", {
      command: "return await routines.list()",
    });
    expect(execute).toHaveBeenCalledWith(
      { code: "return await routines.list()" },
      expect.objectContaining({ toolCallId: "call_1" }),
    );
    expect(result.details).toEqual({ code: "return await routines.list()" });
  });

  it("returns a clear error when neither code nor command is set", async () => {
    const execute = vi.fn();
    const tool = bindOfficeExecuteTool({ execute });
    const result = await tool.execute("call_1", {});
    expect(execute).not.toHaveBeenCalled();
    expect(result.details).toMatchObject({
      status: "error",
      error: expect.stringMatching(/code/),
    });
  });
});
