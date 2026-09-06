/** Cap tool JSON before it occupies the live window. Slim fat plugin dumps. */

import { stringifyToolOutput } from "./office-chat.js";

/** When a code/computer result still won't fit the live window. */
export const TOOL_PAYLOAD_MAX_CHARS = 8_000;

const DROP_KEYS = new Set([
  "bodyhtml",
  "html_body",
  "htmlbody",
  "message_text",
  "messagetext",
  "payload",
  "raw",
]);

const SLIM_STRING = 400;
const SLIM_ARRAY = 15;

export function stringifyToolPayload(value: unknown): string {
  return stringifyToolOutput(value);
}

export function persistToolPayload(
  value: unknown,
  maxChars = TOOL_PAYLOAD_MAX_CHARS,
): { text: string; details: unknown } {
  const text = stringifyToolPayload(value);
  if (text.length <= maxChars) return { text, details: value };
  const preview = text.slice(0, maxChars);
  return {
    text: `Result truncated at ${preview.length} of ${text.length} chars. Return a smaller object from code.\n${preview}`,
    details: { truncated: true, bytes: text.length },
  };
}

/** Drop MIME/body dumps so the sandbox can map from/subject/date. */
export function slimPluginResult(value: unknown): unknown {
  return slimValue(value, SLIM_STRING, SLIM_ARRAY);
}

export async function capToolPayload(
  value: unknown,
  opts?: {
    maxChars?: number;
    disk?: unknown;
    name?: string;
  },
): Promise<unknown> {
  const maxChars = opts?.maxChars ?? TOOL_PAYLOAD_MAX_CHARS;
  const slim = slimPluginResult(value);
  if (stringifyToolPayload(slim).length <= maxChars) return slim;
  return slimValue(value, 120, 8);
}

function slimValue(
  value: unknown,
  maxString: number,
  maxArray: number,
): unknown {
  if (typeof value === "string") {
    return value.length > maxString ? `${value.slice(0, maxString)}…` : value;
  }
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, maxArray)
      .map((row) => slimValue(row, maxString, maxArray));
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (DROP_KEYS.has(key.toLowerCase())) continue;
    out[key] = slimValue(child, maxString, maxArray);
  }
  return out;
}
