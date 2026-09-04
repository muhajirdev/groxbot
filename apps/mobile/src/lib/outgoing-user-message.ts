import { userBoundFromText } from "@groxbot/core/browser";

function textFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const row = part as { type?: unknown; text?: unknown };
      if (row.type !== "text" || typeof row.text !== "string") return [];
      return [row.text];
    })
    .join("")
    .trim();
}

export function textFromOutgoingPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }
  const row = payload as Record<string, unknown>;
  if (typeof row.text === "string" && row.text.trim()) return row.text.trim();
  return textFromParts(row.parts);
}

export function seedOutgoingUserMessage(payload: unknown, id: string) {
  const text = textFromOutgoingPayload(payload);
  if (!text) return null;
  const metadata =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { metadata?: unknown }).metadata
      : undefined;
  return userBoundFromText({ id, content: text, metadata });
}
