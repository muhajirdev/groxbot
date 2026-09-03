import type { UIMessage } from "ai";

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

/** Stamp a send payload as a local user row so the bubble appears before the socket. */
export function seedOutgoingUserMessage(
  payload: unknown,
  id: string,
): UIMessage | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const row = payload as Record<string, unknown>;
  const metadata = row.metadata;
  if (Array.isArray(row.parts)) {
    return {
      id,
      role: "user",
      parts: row.parts as UIMessage["parts"],
      ...(metadata !== undefined ? { metadata } : {}),
    } as UIMessage;
  }
  if (typeof row.text === "string") {
    return {
      id,
      role: "user",
      parts: [{ type: "text", text: row.text }],
      ...(metadata !== undefined ? { metadata } : {}),
    } as UIMessage;
  }
  return null;
}
