import { describe, expect, it } from "vitest";
import {
  capToolPayload,
  failedToolMessage,
  isFailedToolValue,
  persistOfficeToolPayload,
  persistToolPayload,
  slimPluginResult,
  stringifyToolPayload,
  TOOL_PAYLOAD_MAX_CHARS,
} from "./tool-payload.js";

describe("slimPluginResult", () => {
  it("keeps from/subject and drops the MIME body", () => {
    const slim = slimPluginResult({
      data: {
        messages: [
          {
            sender: "Ada <ada@x.com>",
            subject: "Hello",
            messageTimestamp: "2026-09-06T14:31:56Z",
            messageText: "x".repeat(50_000),
            payload: { headers: [{ name: "Received", value: "y".repeat(8_000) }] },
          },
        ],
      },
    });
    expect(slim).toEqual({
      data: {
        messages: [
          {
            sender: "Ada <ada@x.com>",
            subject: "Hello",
            messageTimestamp: "2026-09-06T14:31:56Z",
          },
        ],
      },
    });
  });
});

describe("capToolPayload", () => {
  it("passes through a small object", async () => {
    const value = { ok: true, n: 3 };
    await expect(capToolPayload(value)).resolves.toEqual(value);
  });

  it("returns compact email fields instead of a spill file", async () => {
    const capped = await capToolPayload({
      data: {
        messages: [
          {
            sender: "Ada",
            subject: "Hello",
            messageText: "x".repeat(80_000),
            payload: { body: "y".repeat(80_000) },
          },
        ],
      },
    });
    expect(capped).toEqual({
      data: { messages: [{ sender: "Ada", subject: "Hello" }] },
    });
  });
});

describe("persistToolPayload", () => {
  it("keeps small results as-is", () => {
    const value = { ok: true };
    expect(persistToolPayload(value)).toEqual({
      text: '{"ok":true}',
      details: value,
    });
  });

  it("truncates a huge persist body", () => {
    const value = { body: "z".repeat(TOOL_PAYLOAD_MAX_CHARS) };
    const persisted = persistToolPayload(value, 24);
    expect(persisted.details).toEqual({
      truncated: true,
      bytes: stringifyToolPayload(value).length,
    });
    expect(persisted.text).toMatch(/^Result truncated at 24 of /);
    expect(persisted.text).not.toMatch(/from code/);
    expect(persisted.text.length).toBeGreaterThan(24);
    expect(persisted.text.length).toBeLessThan(stringifyToolPayload(value).length);
  });

  it("keeps nextOffset when a generic persist body is clipped", () => {
    const value = {
      entries: Array.from({ length: 40 }, (_, i) => ({ i, pad: "x".repeat(200) })),
      nextOffset: 40,
    };
    const persisted = persistToolPayload(value, 400);
    expect(persisted.text).toMatch(/offset=40|nextOffset/);
  });

  it("strips connector calls so a small code result is not truncated", () => {
    const markdown = "m".repeat(20_000);
    const persisted = persistToolPayload({
      status: "completed",
      executionId: "exec_1",
      result: { page: "keep me" },
      calls: [
        {
          seq: 0,
          connector: "tools",
          method: "to_markdown",
          args: { path: "/inbox/a.pdf" },
          result: { ok: true, markdown },
        },
      ],
    });
    expect(persisted.details).toMatchObject({
      status: "completed",
      result: { page: "keep me" },
      calls: [
        {
          seq: 0,
          connector: "tools",
          method: "to_markdown",
          result: { omitted: true, keys: ["ok", "markdown"] },
        },
      ],
    });
    expect(persisted.text).toContain("keep me");
    expect(persisted.text).not.toContain(markdown);
    expect(persisted.text).not.toMatch(/^Result truncated/);
  });
});

describe("persistOfficeToolPayload", () => {
  const jpeg = `/9j/${"A".repeat(80)}`;

  it("attaches a SineMart invoice image and omits imageBase64 from text", () => {
    const attached = persistOfficeToolPayload({
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
    });
    expect(attached.content).toContainEqual({
      type: "image",
      data: jpeg,
      mimeType: "image/jpeg",
    });
    const text = attached.content.find((part) => part.type === "text");
    expect(text?.type).toBe("text");
    if (text?.type === "text") {
      expect(text.text).toContain("image/jpeg");
      expect(text.text).toContain("byteLength");
      expect(text.text).not.toContain(jpeg);
      expect(text.text).toMatch(/image attached/);
      expect(text.text).not.toMatch(/^Result truncated/);
    }
    expect(JSON.stringify(attached.details)).not.toContain(jpeg);
  });

  it("attaches MCP { type: image, data, mimeType } from a nested call", () => {
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const attached = persistOfficeToolPayload({
      status: "completed",
      result: {
        content: [{ type: "image", data: png, mimeType: "image/png" }],
      },
      calls: [
        {
          connector: "files",
          method: "get_screenshot",
          result: {
            content: [{ type: "image", data: png, mimeType: "image/png" }],
          },
        },
      ],
    });
    expect(attached.content).toContainEqual({
      type: "image",
      data: png,
      mimeType: "image/png",
    });
    const text = attached.content.find((part) => part.type === "text");
    if (text?.type === "text") {
      expect(text.text).not.toContain(png);
    }
  });

  it("still slims non-image connector calls to keys", () => {
    const markdown = "m".repeat(20_000);
    const persisted = persistOfficeToolPayload({
      status: "completed",
      executionId: "exec_1",
      result: { page: "keep me" },
      calls: [
        {
          seq: 0,
          connector: "tools",
          method: "to_markdown",
          result: { ok: true, markdown },
        },
      ],
    });
    expect(persisted.content).toEqual([
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("keep me"),
      }),
    ]);
    const text = persisted.content[0];
    if (text?.type === "text") {
      expect(text.text).not.toContain(markdown);
    }
  });
});

describe("isFailedToolValue", () => {
  it("treats ok:false, status error, and CF error strings as failures", () => {
    expect(isFailedToolValue({ ok: false, message: "nope" })).toBe(true);
    expect(isFailedToolValue({ status: "error", error: "boom" })).toBe(true);
    expect(isFailedToolValue({ error: "File not found: /x" })).toBe(true);
    expect(isFailedToolValue({ ok: true, markdown: "x" })).toBe(false);
    expect(failedToolMessage({ ok: false, message: "Pass html or a path, not both." })).toBe(
      "Pass html or a path, not both.",
    );
  });
});
