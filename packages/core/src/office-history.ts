/** Search this office Pi branch. Truth is the session; this is a ranker. */

import { isHiddenOfficeUserMessage, isOfficeReviewSkip } from "@groxbot/contracts";
import {
  type KnowledgeSearchDoc,
  MAX_KNOWLEDGE_SEARCH_HITS,
  rankKnowledgeSearch,
} from "./knowledge-search.js";
import {
  type PiBoundMessage,
  piAssistantText,
  piUserText,
} from "./pi-transcript.js";

export const MAX_OFFICE_HISTORY_HITS = MAX_KNOWLEDGE_SEARCH_HITS;
export const MAX_OFFICE_HISTORY_DOCS = 800;
export const MAX_OFFICE_HISTORY_TEXT = 4_000;

export class OfficeHistoryError extends Error {
  constructor(message = "Ask what to find in this thread.") {
    super(message);
    this.name = "OfficeHistoryError";
  }
}

export type OfficeHistoryHit = {
  id: string;
  role: "user" | "assistant";
  at?: string;
  score: number;
  snippet: string;
};

export type OfficeHistorySearch = {
  hits: OfficeHistoryHit[];
  truncated: boolean;
};

export function officeHistoryText(message: PiBoundMessage["message"]): string {
  if (message.role === "user") return piUserText(message);
  if (message.role === "assistant") return piAssistantText(message);
  return "";
}

function lastUserId(messages: readonly PiBoundMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (row?.message.role === "user") return row.id;
  }
  return null;
}

function timestampIso(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

function historyDoc(row: PiBoundMessage, text: string): KnowledgeSearchDoc {
  const clipped = clip(text, MAX_OFFICE_HISTORY_TEXT);
  const title = clipped.split("\n")[0]?.slice(0, 80) ?? "";
  return {
    path: row.id,
    title,
    description: row.message.role,
    text: clipped,
  };
}

export function searchOfficeHistory(
  messages: readonly PiBoundMessage[],
  query: string,
  opts?: { limit?: number; excludeLastUser?: boolean },
): OfficeHistorySearch {
  const needle = query.trim();
  if (!needle) throw new OfficeHistoryError();
  const skipId = opts?.excludeLastUser ? lastUserId(messages) : null;
  const indexed: PiBoundMessage[] = [];
  for (const row of messages) {
    if (skipId && row.id === skipId) continue;
    if (
      isHiddenOfficeUserMessage({
        role: row.message.role,
        metadata: row.metadata,
      })
    ) {
      continue;
    }
    const text = officeHistoryText(row.message);
    if (!text) continue;
    if (
      row.message.role === "assistant" &&
      isOfficeReviewSkip(text)
    ) {
      continue;
    }
    indexed.push(row);
  }
  const truncated = indexed.length > MAX_OFFICE_HISTORY_DOCS;
  const window = truncated
    ? indexed.slice(indexed.length - MAX_OFFICE_HISTORY_DOCS)
    : indexed;
  const byId = new Map(window.map((row) => [row.id, row]));
  const hits = rankKnowledgeSearch(
    window.map((row) => historyDoc(row, officeHistoryText(row.message))),
    needle,
    opts?.limit,
  ).flatMap((hit) => {
    const row = byId.get(hit.path);
    if (!row) return [];
    const role = row.message.role;
    if (role !== "user" && role !== "assistant") return [];
    const out: OfficeHistoryHit = {
      id: row.id,
      role,
      score: hit.score,
      snippet: hit.snippet,
    };
    const at = timestampIso(row.message.timestamp);
    if (at) out.at = at;
    return [out];
  });
  return { hits, truncated };
}
