import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  aiToolToPi,
  bindOfficeExecuteTool,
  jsonSchemaFrom,
  officeAgentTool,
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

  it("throws when neither code nor command is set", async () => {
    const execute = vi.fn();
    const tool = bindOfficeExecuteTool({ execute });
    await expect(tool.execute("call_1", {})).rejects.toThrow(/code/);
    expect(execute).not.toHaveBeenCalled();
  });

  it("caps a huge code result before it is stored", async () => {
    const tool = bindOfficeExecuteTool({
      execute: async () => ({ body: "x".repeat(40_000) }),
    });
    const result = await tool.execute("call_1", { code: "return 1" });
    const text = result.content[0];
    expect(text?.type).toBe("text");
    if (text?.type === "text") {
      expect(text.text.length).toBeLessThan(40_000);
      expect(text.text).toMatch(/truncated/);
    }
    expect(result.details).toEqual({
      truncated: true,
      bytes: expect.any(Number),
    });
  });

  it("strips connector calls so a compact code return fits the live window", async () => {
    const markdown = "m".repeat(20_000);
    const tool = bindOfficeExecuteTool({
      execute: async () => ({
        status: "completed",
        executionId: "exec_1",
        result: { page: 1 },
        calls: [
          {
            seq: 0,
            connector: "tools",
            method: "to_markdown",
            result: { ok: true, markdown },
          },
        ],
      }),
    });
    const result = await tool.execute("call_1", { code: "return 1" });
    const text = result.content[0];
    expect(text?.type).toBe("text");
    if (text?.type === "text") {
      expect(text.text).toContain('"page":1');
      expect(text.text).not.toContain(markdown);
      expect(text.text).not.toMatch(/truncated/);
    }
  });

  it("throws when the sandbox reports status error", async () => {
    const tool = bindOfficeExecuteTool({
      execute: async () => ({
        status: "error",
        error: 'Tool "write" not found on tools',
      }),
    });
    await expect(tool.execute("call_1", { code: "return 1" })).rejects.toThrow(
      /write/,
    );
  });
});

describe("officeAgentTool", () => {
  it("throws on ok:false so Pi marks isError", async () => {
    const tool = officeAgentTool({
      name: "to_markdown",
      description: "convert",
      parameters: z.object({}),
      execute: async () => ({
        ok: false,
        message: "Pass html or a path, not both.",
      }),
    });
    await expect(tool.execute("call_1", {})).rejects.toThrow(/not both/);
  });
});

describe("aiToolToPi", () => {
  it("rewrites relative computer paths before execute", async () => {
    const execute = vi.fn(async (input: unknown) => input);
    const tool = aiToolToPi("read", { execute });
    expect(tool).not.toBeNull();
    await tool!.execute("call_1", { path: "inbox/a.pdf" });
    expect(execute).toHaveBeenCalledWith(
      { path: "/inbox/a.pdf" },
      expect.objectContaining({ toolCallId: "call_1" }),
    );
  });

  it("defaults find path to /", async () => {
    const execute = vi.fn(async (input: unknown) => input);
    const tool = aiToolToPi("find", { execute });
    await tool!.execute("call_1", { pattern: "**/*.pdf" });
    expect(execute).toHaveBeenCalledWith(
      { pattern: "**/*.pdf", path: "/" },
      expect.anything(),
    );
  });

  it("refuses a base64 PDF from read", async () => {
    const tool = aiToolToPi("read", {
      execute: async () => ({
        kind: "file",
        path: "/inbox/scope.pdf",
        mediaType: "application/pdf",
        data: "JVBERi0xLjQK",
      }),
    });
    await expect(
      tool!.execute("call_1", { path: "/inbox/scope.pdf" }),
    ).rejects.toThrow(/to_markdown/);
  });
});
