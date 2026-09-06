/** Live-window prune. The Pi session stays whole; only the LLM call sees less. */

import { TOOL_PAYLOAD_MAX_CHARS } from "./tool-payload.js";

export const LIVE_TOOL_RESULT_MAX_CHARS = TOOL_PAYLOAD_MAX_CHARS;
export const LIVE_TOOL_RESULT_STALE_CHARS = 800;

export type LiveContextMessage = {
  role: string;
  content?: unknown;
  details?: unknown;
  toolName?: string;
  toolCallId?: string;
};

export function pruneLiveToolResults<M extends { role: string }>(
  messages: readonly M[],
  opts?: { maxChars?: number; staleChars?: number },
): M[] {
  const maxChars = opts?.maxChars ?? LIVE_TOOL_RESULT_MAX_CHARS;
  const staleChars = opts?.staleChars ?? LIVE_TOOL_RESULT_STALE_CHARS;
  const lastUser = lastUserIndex(messages);
  const lastTool = lastToolResultIndex(messages);
  return messages.map((message, index) => {
    if (message.role !== "toolResult") return message;
    const row = message as M & LiveContextMessage;
    const text = liveToolResultText(row);
    const stale = index <= lastUser || index < lastTool;
    const budget = stale ? staleChars : maxChars;
    if (text.length <= budget) return message;
    return stubLiveToolResult(row, text, { stale, budget });
  });
}

function lastUserIndex(messages: readonly { role: string }[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return i;
  }
  return -1;
}

function lastToolResultIndex(messages: readonly { role: string }[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "toolResult") return i;
  }
  return -1;
}

export function liveToolResultText(message: LiveContextMessage): string {
  const fromContent = contentText(message.content);
  if (fromContent) return fromContent;
  return stringifyUnknown(message.details);
}

function stubLiveToolResult<M extends LiveContextMessage>(
  message: M,
  text: string,
  opts: { stale: boolean; budget: number },
): M {
  const name =
    typeof message.toolName === "string" && message.toolName.trim()
      ? message.toolName.trim()
      : "tool";
  const stub = opts.stale
    ? `Omitted from the live window (${text.length} chars, ${name}). Re-run the tool in code.`
    : `${text.slice(0, opts.budget)}\n… (${text.length} chars, truncated)`;
  return {
    ...message,
    content: [{ type: "text", text: stub }],
    details: { omitted: true, bytes: text.length },
  } as M;
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const row = part as { type?: unknown; text?: unknown };
    if (row.type === "text" && typeof row.text === "string") parts.push(row.text);
  }
  return parts.join("");
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
