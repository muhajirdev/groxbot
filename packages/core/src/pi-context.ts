/** Live-window prune. The Pi session stays whole; only the LLM call sees less. */

import { COMPUTER_SHAPE_TOOLS, liveToolResultHasImage } from "./computer-fs.js";
import { TOOL_PAYLOAD_MAX_CHARS } from "./tool-payload.js";
import { clipKeepTail, TOOL_TRUNCATE_MAX_BYTES } from "./tool-truncate.js";

export const LIVE_TOOL_RESULT_MAX_CHARS = TOOL_PAYLOAD_MAX_CHARS;
export const LIVE_TOOL_RESULT_STALE_CHARS = 800;

/**
 * Source dumps the model must keep using after the next grep/list/shell.
 * Stubbing these on the same user turn is what made invoice runs re-read
 * a PDF that `read` / `to_markdown` already returned.
 */
const LIVE_TURN_FILE_TOOLS = new Set([
  "read",
  "to_markdown",
  "fetch_url",
]);

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
    const priorTurn = index <= lastUser;
    const staleOnTurn = index < lastTool;
    if (
      liveToolResultHasImage(row.content) &&
      (priorTurn || hasLaterImage(messages, index, lastUser))
    ) {
      return stubLiveToolResult(row, text, {
        stale: true,
        budget: staleChars,
        image: true,
      });
    }
    const budget = liveResultBudget(row, {
      priorTurn,
      staleOnTurn,
      maxChars,
      staleChars,
    });
    if (text.length <= budget) return message;
    return stubLiveToolResult(row, text, {
      stale: priorTurn || staleOnTurn,
      budget,
    });
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

function liveResultBudget(
  row: LiveContextMessage,
  opts: {
    priorTurn: boolean;
    staleOnTurn: boolean;
    maxChars: number;
    staleChars: number;
  },
): number {
  const name = typeof row.toolName === "string" ? row.toolName : "";
  if (opts.priorTurn) return opts.staleChars;
  if (opts.staleOnTurn && !LIVE_TURN_FILE_TOOLS.has(name)) {
    return opts.staleChars;
  }
  if (isLiveFilePageTool(name)) {
    return Math.max(opts.maxChars, TOOL_TRUNCATE_MAX_BYTES);
  }
  return opts.maxChars;
}

function isLiveFilePageTool(name: string): boolean {
  return (
    COMPUTER_SHAPE_TOOLS.has(name) ||
    name === "to_markdown" ||
    name === "fetch_url"
  );
}

export function liveToolResultText(message: LiveContextMessage): string {
  const fromContent = contentText(message.content);
  if (fromContent) return fromContent;
  return stringifyUnknown(message.details);
}

function stubLiveToolResult<M extends LiveContextMessage>(
  message: M,
  text: string,
  opts: { stale: boolean; budget: number; image?: boolean },
): M {
  const name =
    typeof message.toolName === "string" && message.toolName.trim()
      ? message.toolName.trim()
      : "tool";
  const stub = opts.image
    ? `Omitted from the live window (image, ${name}).`
    : opts.stale
      ? `Omitted from the live window (${text.length} chars, ${name}).`
      : name === "shell"
        ? `${text.slice(Math.max(0, text.length - opts.budget))}\n… (${text.length} chars, truncated)`
        : `${clipKeepTail(text, opts.budget)}\n… (${text.length} chars, truncated)`;
  return {
    ...message,
    content: [{ type: "text", text: stub }],
    details: {
      omitted: true,
      bytes: text.length,
      ...(opts.image ? { image: true } : {}),
    },
  } as M;
}

function hasLaterImage<M extends { role: string }>(
  messages: readonly M[],
  index: number,
  lastUser: number,
): boolean {
  for (let i = index + 1; i < messages.length; i++) {
    if (i <= lastUser) continue;
    const row = messages[i] as LiveContextMessage;
    if (row.role === "toolResult" && liveToolResultHasImage(row.content)) {
      return true;
    }
  }
  return false;
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
