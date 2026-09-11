import { TOOL_FILE_MAX_CHARS } from "@groxbot/core";
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

  it("attaches a SineMart view_invoice_image dump for vision", async () => {
    const jpeg = `/9j/${"A".repeat(80)}`;
    const tool = bindOfficeExecuteTool({
      execute: async () => ({
        status: "completed",
        executionId: "exec_1",
        result: {
          mimeType: "image/jpeg",
          byteLength: 12_345,
          imageBase64: jpeg,
        },
        calls: [
          {
            seq: 0,
            connector: "sinemart",
            method: "view_invoice_image",
            result: {
              mimeType: "image/jpeg",
              byteLength: 12_345,
              imageBase64: jpeg,
            },
          },
        ],
      }),
    });
    const result = await tool.execute("call_1", {
      code: 'return await sinemart.view_invoice_image({ invoiceId: "inv_1" })',
    });
    expect(result.content).toContainEqual({
      type: "image",
      data: jpeg,
      mimeType: "image/jpeg",
    });
    const text = result.content.find((part) => part.type === "text");
    expect(text?.type).toBe("text");
    if (text?.type === "text") {
      expect(text.text).toContain('"mimeType":"image/jpeg"');
      expect(text.text).not.toContain(jpeg);
      expect(text.text).not.toMatch(/truncated/);
    }
    expect(JSON.stringify(result.details)).not.toContain(jpeg);
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

  it("does not stringify an image tool result into the text dump", async () => {
    const png = "abc";
    const tool = officeAgentTool({
      name: "render_screenshot",
      description: "shot",
      parameters: z.object({}),
      execute: async () => ({
        content: [
          { type: "text" as const, text: "Screenshot saved to workspace/a.png (3 bytes)." },
          { type: "image" as const, data: png, mimeType: "image/png" },
        ],
        details: { path: "workspace/a.png", mediaType: "image/png", bytes: 3 },
      }),
    });
    const result = await tool.execute("call_1", {});
    expect(result.content).toEqual([
      { type: "text", text: "Screenshot saved to workspace/a.png (3 bytes)." },
      { type: "image", data: png, mimeType: "image/png" },
    ]);
    expect(JSON.stringify(result.details)).not.toContain(png);
  });

  it("does not 8k-cap a 19k to_markdown page", async () => {
    const body = "n".repeat(19_662);
    const tool = officeAgentTool({
      name: "to_markdown",
      description: "convert",
      parameters: z.object({}),
      maxChars: TOOL_FILE_MAX_CHARS,
      retain: "head",
      execute: async () => body,
    });
    const result = await tool.execute("call_1", {});
    const text = result.content[0];
    expect(text?.type).toBe("text");
    if (text?.type === "text") {
      expect(text.text).toBe(body);
      expect(text.text).not.toMatch(/Result truncated/);
    }
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

  it("refuses a base64 PDF from read when conversion is not wired", async () => {
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

  it("converts a PDF inside read and skips the computer dump", async () => {
    const execute = vi.fn(async () => ({
      kind: "file",
      path: "/inbox/scope.pdf",
      mediaType: "application/pdf",
      data: "JVBERi0xLjQK",
    }));
    const readDocument = vi.fn(async () => "# Scope\n\nHello from pdf");
    const tool = aiToolToPi(
      "read",
      { execute },
      { readDocument },
    );
    const result = await tool!.execute("call_1", {
      path: "inbox/scope.pdf",
      offset: 1,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(readDocument).toHaveBeenCalledWith({
      path: "/inbox/scope.pdf",
      offset: 1,
    });
    const text = result.content[0];
    expect(text?.type).toBe("text");
    if (text?.type === "text") {
      expect(text.text).toContain("# Scope");
      expect(text.text).toContain("Hello from pdf");
    }
  });

  it("does not convert a PNG through readDocument — it attaches the image", async () => {
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const execute = vi.fn(async () => ({
      kind: "file",
      path: "/workspace/invoice.png",
      mediaType: "image/png",
      data: png,
    }));
    const readDocument = vi.fn(async () => "# caption");
    const tool = aiToolToPi("read", { execute }, { readDocument });
    const result = await tool!.execute("call_1", {
      path: "/workspace/invoice.png",
    });
    expect(readDocument).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();
    expect(result.content).toEqual([
      {
        type: "text",
        text: "Read image file [image/png] workspace/invoice.png",
      },
      { type: "image", data: png, mimeType: "image/png" },
    ]);
  });

  it("does not convert a text file through readDocument", async () => {
    const execute = vi.fn(async () => ({
      path: "/workspace/notes.md",
      content: "# hi",
      startLine: 1,
      endLine: 1,
    }));
    const readDocument = vi.fn(async () => "converted");
    const tool = aiToolToPi("read", { execute }, { readDocument });
    const result = await tool!.execute("call_1", { path: "notes.md" });
    expect(readDocument).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();
    const text = result.content[0];
    expect(text?.type).toBe("text");
    if (text?.type === "text") {
      expect(text.text).toContain("# hi");
    }
  });

  it("returns read text with an offset footer, not a JSON blob", async () => {
    const tool = aiToolToPi("read", {
      execute: async () => ({
        path: "/workspace/invoice.html",
        content: "<p>hi</p>",
        startLine: 1,
        endLine: 1,
        truncated: true,
        nextOffset: 2,
      }),
    });
    const result = await tool!.execute("call_1", { path: "invoice.html" });
    const text = result.content[0];
    expect(text?.type).toBe("text");
    if (text?.type === "text") {
      expect(text.text).toContain("<p>hi</p>");
      expect(text.text).toMatch(/offset=2/);
      expect(text.text.startsWith("{")).toBe(false);
    }
  });

  it("throws when shell exits non-zero", async () => {
    const tool = aiToolToPi("shell", {
      execute: async () => ({
        command: "false",
        exitCode: 2,
        stdout: "",
        stderr: "nope",
      }),
    });
    await expect(tool!.execute("call_1", { command: "false" })).rejects.toThrow(
      /exited with code 2/,
    );
  });

  it("refuses pdfinfo before the Worker shell runs", async () => {
    const execute = vi.fn();
    const tool = aiToolToPi("shell", { execute });
    await expect(
      tool!.execute("call_1", {
        command:
          "pdfinfo inbox/agreement-sinemart-2026.pdf | sed -n '1,20p'",
      }),
    ).rejects.toThrow(/read\(\)/);
    expect(execute).not.toHaveBeenCalled();
  });

  it("defaults grep path to /", async () => {
    const execute = vi.fn(async (input: unknown) => input);
    const tool = aiToolToPi("grep", { execute });
    await tool!.execute("call_1", { query: "TODO" });
    expect(execute).toHaveBeenCalledWith(
      { query: "TODO", path: "/" },
      expect.anything(),
    );
  });
});
