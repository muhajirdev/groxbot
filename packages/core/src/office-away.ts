/** Long office turn while nobody is on the Cap’n Web. Testing threshold is 30s. */

import {
  isHiddenOfficeUserMessage,
  parseOfficeUserMeta,
} from "@groxbot/contracts";

export const OFFICE_AWAY_TURN_MS = 30_000;
export const OFFICE_AWAY_SETTLE_MS = 5_000;
export const OFFICE_AWAY_STORAGE = "officeAway";
export const OFFICE_AWAY_CALLBACK = "runAwayOfficePing" as const;
export const OFFICE_AWAY_EXCERPT_MAX = 140;

export type OfficeAwayPayload = {
  seq: number;
  excerpt?: string;
  toUserId?: string;
};

export type OfficeAwayStored = {
  seq: number;
  scheduleId?: string;
  pingedSeq?: number;
};

export function shouldArmAwayOfficePing(input: {
  visible: boolean;
  startedAt: number;
  now: number;
  subscriberCount: number;
  touched: boolean;
  seq: number;
  pingedSeq?: number;
  minDurationMs?: number;
}): boolean {
  if (!input.visible) return false;
  if (input.touched) return false;
  if (input.subscriberCount > 0) return false;
  if (!(input.seq > 0)) return false;
  if (input.pingedSeq === input.seq) return false;
  if (!(input.startedAt > 0)) return false;
  const min = input.minDurationMs ?? OFFICE_AWAY_TURN_MS;
  return input.now - input.startedAt >= min;
}

export function shouldSendAwayOfficePing(input: {
  subscriberCount: number;
  seq: number;
  stored: OfficeAwayStored | null | undefined;
}): boolean {
  if (input.subscriberCount > 0) return false;
  const stored = input.stored;
  if (!stored) return false;
  if (stored.seq !== input.seq) return false;
  if (stored.pingedSeq === input.seq) return false;
  return true;
}

export function parseOfficeAwayPayload(
  value: unknown,
): OfficeAwayPayload | null {
  if (!value || typeof value !== "object") return null;
  const seq = (value as { seq?: unknown }).seq;
  if (typeof seq !== "number" || !Number.isFinite(seq) || seq <= 0) return null;
  const excerpt = (value as { excerpt?: unknown }).excerpt;
  const toUserId = (value as { toUserId?: unknown }).toUserId;
  const to =
    typeof toUserId === "string" && toUserId.trim() ? toUserId.trim() : "";
  if (!to) return null;
  return {
    seq,
    excerpt: typeof excerpt === "string" ? excerpt : undefined,
    toUserId: to,
  };
}

export function parseOfficeAwayStored(value: unknown): OfficeAwayStored | null {
  if (!value || typeof value !== "object") return null;
  const seq = (value as { seq?: unknown }).seq;
  if (typeof seq !== "number" || !Number.isFinite(seq) || seq <= 0) return null;
  const scheduleId = (value as { scheduleId?: unknown }).scheduleId;
  const pingedSeq = (value as { pingedSeq?: unknown }).pingedSeq;
  return {
    seq,
    scheduleId:
      typeof scheduleId === "string" && scheduleId ? scheduleId : undefined,
    pingedSeq:
      typeof pingedSeq === "number" && Number.isFinite(pingedSeq)
        ? pingedSeq
        : undefined,
  };
}

export function awayOfficeExcerpt(
  text: string,
  max = OFFICE_AWAY_EXCERPT_MAX,
): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (!line) return "";
  if (line.length <= max) return line;
  return `${line.slice(0, max - 1)}…`;
}

/** Last visible human on the office log — skip intro/review/routine kicks. */
export function lastOfficeHumanUserId(
  messages: ReadonlyArray<{
    metadata?: unknown;
    message?: { role?: string };
  }>,
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (row?.message?.role !== "user") continue;
    if (isHiddenOfficeUserMessage({ role: "user", metadata: row.metadata })) {
      return null;
    }
    return parseOfficeUserMeta(row.metadata)?.userId ?? null;
  }
  return null;
}
