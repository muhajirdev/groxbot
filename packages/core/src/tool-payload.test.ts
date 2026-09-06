import { describe, expect, it } from "vitest";
import {
  capToolPayload,
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
    expect(persisted.text).toMatch(/Return a smaller object from code/);
    expect(persisted.text.length).toBeGreaterThan(24);
    expect(persisted.text.length).toBeLessThan(stringifyToolPayload(value).length);
  });
});
