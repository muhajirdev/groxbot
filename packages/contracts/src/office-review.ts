/** Hidden Think trigger for post-turn office filing. Not a human sender. */

export const OFFICE_REVIEW_SOURCE = "office-review";
export const OFFICE_REVIEW_SKIP = "Skip";

export function isOfficeReviewSource(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const row = metadata as Record<string, unknown>;
  if (row.source === OFFICE_REVIEW_SOURCE) return true;
  const custom =
    row.custom && typeof row.custom === "object"
      ? (row.custom as Record<string, unknown>)
      : null;
  return custom?.source === OFFICE_REVIEW_SOURCE;
}

export function isOfficeReviewUserMessage(message: {
  role?: string;
  metadata?: unknown;
}): boolean {
  return message.role === "user" && isOfficeReviewSource(message.metadata);
}

export function isOfficeReviewSkip(text: string): boolean {
  return text.trim() === OFFICE_REVIEW_SKIP;
}
