/** Cap tool JSON before it occupies the live window. Slim fat plugin dumps. */

import {
  extractOfficeImagesFromPayload,
  isOfficeImageToolResult,
  type OfficeImageToolResult,
  officeImagesToolResult,
} from "./computer-fs.js";
import { stringifyToolOutput } from "./office-chat.js";
import { clipKeepTail, type TruncationRetain } from "./tool-truncate.js";

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
  "imagebase64",
  "image_base64",
  "base64image",
  "base64_image",
]);

const SLIM_STRING = 400;
const SLIM_ARRAY = 15;

export function stringifyToolPayload(value: unknown): string {
  return stringifyToolOutput(value);
}

/**
 * Code Mode attaches `calls[].result` with the full connector payload.
 * Models shrink `result` and still blow the 8k cap. Drop those bodies.
 */
export function slimCodeModeCalls(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.calls)) return value;
  return {
    ...row,
    calls: row.calls.map((call) => slimCodeModeCall(call)),
  };
}

function slimCodeModeCall(call: unknown): unknown {
  if (!call || typeof call !== "object" || Array.isArray(call)) return call;
  const row = call as Record<string, unknown>;
  const result = row.result;
  const keys =
    result && typeof result === "object" && !Array.isArray(result)
      ? Object.keys(result)
      : [];
  return {
    ...(typeof row.seq === "number" ? { seq: row.seq } : {}),
    ...(typeof row.connector === "string" ? { connector: row.connector } : {}),
    ...(typeof row.method === "string" ? { method: row.method } : {}),
    result: {
      omitted: true,
      ...(keys.length ? { keys } : {}),
    },
  };
}

export function persistToolPayload(
  value: unknown,
  maxChars = TOOL_PAYLOAD_MAX_CHARS,
  opts?: { retain?: TruncationRetain },
): { text: string; details: unknown } {
  const prepared = slimCodeModeCalls(value);
  const text = stringifyToolPayload(prepared);
  if (text.length <= maxChars) return { text, details: prepared };
  const hint = isCodeModeResult(prepared)
    ? " Return a smaller `result` from code — connector `calls` are already stripped."
    : "";
  const clipped =
    opts?.retain === "tail"
      ? `${text.slice(Math.max(0, text.length - maxChars))}`
      : clipKeepTail(text, maxChars);
  return {
    text: `Result truncated at ${Math.min(maxChars, clipped.length)} of ${text.length} chars.${hint}\n${clipped}`,
    details: { truncated: true, bytes: text.length },
  };
}

/**
 * Persist Code Mode / MCP JSON for the live window. Raster payloads become
 * Pi image parts; the text dump keeps a compact stand-in, not the bytes.
 */
export function persistOfficeToolPayload(
  value: unknown,
  maxChars = TOOL_PAYLOAD_MAX_CHARS,
  opts?: { retain?: TruncationRetain },
):
  | OfficeImageToolResult
  | {
      content: Array<{ type: "text"; text: string }>;
      details: unknown;
    } {
  if (isOfficeImageToolResult(value)) return value;
  const extracted = extractOfficeImagesFromPayload(value);
  const persisted = persistToolPayload(
    extracted.images.length > 0 ? extracted.stripped : value,
    maxChars,
    opts,
  );
  const attached = officeImagesToolResult(extracted.images, persisted.text);
  if (attached) return attached;
  return {
    content: [{ type: "text", text: persisted.text }],
    details: persisted.details,
  };
}

function isCodeModeResult(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    Array.isArray(row.calls) ||
    typeof row.executionId === "string" ||
    row.status === "completed" ||
    row.status === "error"
  );
}

/** Soft `{ ok: false }` / Code Mode `{ status: "error" }` / CF `{ error }` dumps. */
export function isFailedToolValue(value: unknown): boolean {
  if (typeof value === "string") return looksLikeToolCrash(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (row.ok === false) return true;
  if (row.status === "error") return true;
  if (typeof row.error === "string" && row.error.trim()) return true;
  return false;
}

export function failedToolMessage(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Tool failed.";
  }
  const row = value as Record<string, unknown>;
  for (const key of ["message", "error"] as const) {
    const text = row[key];
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  return stringifyToolPayload(value).slice(0, 500) || "Tool failed.";
}

export function looksLikeToolCrash(text: string): boolean {
  return /cannot read propert(?:y|ies) of undefined/i.test(text);
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
