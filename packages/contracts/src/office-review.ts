/** Hidden kicks the human should not see. Not a human sender. */

export const OFFICE_REVIEW_SOURCE = "office-review";
export const OFFICE_INTRO_SOURCE = "office-intro";
export const OFFICE_REVIEW_SKIP = "Skip";

function metadataHasSource(metadata: unknown, source: string): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const row = metadata as Record<string, unknown>;
  if (row.source === source) return true;
  const custom =
    row.custom && typeof row.custom === "object"
      ? (row.custom as Record<string, unknown>)
      : null;
  return custom?.source === source;
}

export function isOfficeReviewSource(metadata: unknown): boolean {
  return metadataHasSource(metadata, OFFICE_REVIEW_SOURCE);
}

export function isOfficeIntroSource(metadata: unknown): boolean {
  return metadataHasSource(metadata, OFFICE_INTRO_SOURCE);
}

export function isOfficeReviewUserMessage(message: {
  role?: string;
  metadata?: unknown;
}): boolean {
  return message.role === "user" && isOfficeReviewSource(message.metadata);
}

export function isOfficeIntroUserMessage(message: {
  role?: string;
  metadata?: unknown;
}): boolean {
  return message.role === "user" && isOfficeIntroSource(message.metadata);
}

/** Office-review and hire-intro triggers. Skip replies stay review-only. */
export function isHiddenOfficeUserMessage(message: {
  role?: string;
  metadata?: unknown;
}): boolean {
  return (
    isOfficeReviewUserMessage(message) || isOfficeIntroUserMessage(message)
  );
}

/** Visible "filed" line after a review that actually wrote something. */
export function isOfficeLearnedMessage(message: {
  role?: string;
  metadata?: unknown;
}): boolean {
  return message.role === "assistant" && isOfficeReviewSource(message.metadata);
}

export function isOfficeReviewSkip(text: string): boolean {
  return text.trim() === OFFICE_REVIEW_SKIP;
}
