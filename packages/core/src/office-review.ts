/** Idle post-turn filing. Same Pi engine; the kick never joins the office log. */

import {
  OFFICE_INTRO_SOURCE,
  OFFICE_REVIEW_SKIP,
  OFFICE_REVIEW_SOURCE,
  isHiddenOfficeUserMessage,
  isOfficeIntroUserMessage,
  isOfficeLearnedMessage,
  isOfficeReviewSkip,
  isOfficeReviewSource,
  isOfficeReviewUserMessage,
} from "@groxbot/contracts";
import { KNOWLEDGE_MARKDOWN_LINK_HINT } from "./knowledge-links.js";

export {
  OFFICE_INTRO_SOURCE,
  OFFICE_REVIEW_SKIP,
  OFFICE_REVIEW_SOURCE,
  isHiddenOfficeUserMessage,
  isOfficeIntroUserMessage,
  isOfficeLearnedMessage,
  isOfficeReviewSkip,
  isOfficeReviewSource,
  isOfficeReviewUserMessage,
};

export const OFFICE_REVIEW_ANNOUNCE_MAX = 200;

export const OFFICE_REVIEW_TOOL_INTERVAL = 15;
export const OFFICE_REVIEW_STORAGE = "officeReview";

export type OfficeReviewCounters = {
  toolIters: number;
  lastMessageTools: number;
};

export function emptyOfficeReviewCounters(): OfficeReviewCounters {
  return { toolIters: 0, lastMessageTools: 0 };
}

export function parseOfficeReviewCounters(
  value: unknown,
): OfficeReviewCounters {
  if (!value || typeof value !== "object") return emptyOfficeReviewCounters();
  const row = value as { toolIters?: unknown; lastMessageTools?: unknown };
  return {
    toolIters: wholeNumber(row.toolIters),
    lastMessageTools: wholeNumber(row.lastMessageTools),
  };
}

function wholeNumber(value: unknown): number {
  return typeof value === "number" && value > 0 ? Math.floor(value) : 0;
}

export function countUiToolParts(parts: unknown): number {
  if (!Array.isArray(parts)) return 0;
  let n = 0;
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const type = (part as { type?: unknown }).type;
    if (typeof type !== "string") continue;
    if (type === "dynamic-tool") n += 1;
    else if (type.startsWith("tool-") && type !== "tool-approval") n += 1;
  }
  return n;
}

/** True when every tool part has a terminal state (or none exist). */
export function assistantTurnSettled(parts: unknown): boolean {
  if (!Array.isArray(parts)) return true;
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const type = (part as { type?: unknown }).type;
    if (typeof type !== "string") continue;
    if (!(type === "dynamic-tool" || type.startsWith("tool-"))) continue;
    const state = (part as { state?: unknown }).state;
    if (typeof state !== "string") continue;
    if (
      state === "input-streaming" ||
      state === "input-available" ||
      state === "approval-requested"
    ) {
      return false;
    }
  }
  return true;
}

/** Continuation turns reuse the same assistant message — count only new tools. */
export function applyOfficeReviewTurn(
  counters: OfficeReviewCounters,
  tools: number,
  continuation: boolean,
): OfficeReviewCounters {
  const delta = continuation
    ? Math.max(0, tools - counters.lastMessageTools)
    : tools;
  if (delta <= 0 && continuation) {
    return { ...counters, lastMessageTools: tools };
  }
  return {
    toolIters: counters.toolIters + Math.max(0, delta),
    lastMessageTools: tools,
  };
}

export function officeReviewDue(
  counters: OfficeReviewCounters,
  interval = OFFICE_REVIEW_TOOL_INTERVAL,
): boolean {
  return counters.toolIters >= interval;
}

/** Queue a review after a settled completion. Auto-continue may still be arming. */
export function shouldEnqueueOfficeReview(input: {
  status: string;
  reviewBusy: boolean;
  hasOfficeKnowledge: boolean;
  settled: boolean;
  counters: OfficeReviewCounters;
  /** False when the human already queued a follow-up. */
  idle?: boolean;
}): boolean {
  if (input.reviewBusy) return false;
  if (input.idle === false) return false;
  if (!input.hasOfficeKnowledge) return false;
  if (input.status !== "completed") return false;
  if (!input.settled) return false;
  return officeReviewDue(input.counters);
}

export function officeReviewUserText(): string {
  return [
    "Office review. Not from a human — never mention it.",
    "If this stretch taught a reusable how-to: knowledge.search, then skill_manage patch or create (skills/<name>/SKILL.md). Patch first.",
    "If you learned a durable fact, set_context: soul is who you are, memory is office facts. Keep it dense.",
    KNOWLEDGE_MARKDOWN_LINK_HINT,
    "If you wrote something, one short line the human will see (the path, or soul/memory). No recap.",
    `If nothing belongs in the office, reply with exactly ${OFFICE_REVIEW_SKIP}.`,
  ].join(" ");
}

/** What the thread shows after a review that actually wrote. Skip stays off the log. */
export function officeReviewAnnounce(text: string): string | null {
  const line = (text.split("\n")[0] ?? "").replace(/\s+/g, " ").trim();
  if (!line || isOfficeReviewSkip(line)) return null;
  if (line.length <= OFFICE_REVIEW_ANNOUNCE_MAX) return line;
  return `${line.slice(0, OFFICE_REVIEW_ANNOUNCE_MAX - 1)}…`;
}

export function officeReviewNoteMetadata(): {
  source: typeof OFFICE_REVIEW_SOURCE;
  custom: { source: typeof OFFICE_REVIEW_SOURCE };
} {
  return {
    source: OFFICE_REVIEW_SOURCE,
    custom: { source: OFFICE_REVIEW_SOURCE },
  };
}

export function officeReviewUserMessage(): {
  id: string;
  role: "user";
  parts: [{ type: "text"; text: string }];
  createdAt: Date;
  metadata: {
    source: typeof OFFICE_REVIEW_SOURCE;
    custom: { source: typeof OFFICE_REVIEW_SOURCE };
  };
} {
  return {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text: officeReviewUserText() }],
    createdAt: new Date(),
    metadata: {
      source: OFFICE_REVIEW_SOURCE,
      custom: { source: OFFICE_REVIEW_SOURCE },
    },
  };
}
