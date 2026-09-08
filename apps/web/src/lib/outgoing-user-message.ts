import { userBoundFromText } from "@groxbot/core/browser";

function textsFromParts(parts: unknown): string[] {
  if (!Array.isArray(parts)) return [];
  return parts.flatMap((part) => {
    if (!part || typeof part !== "object") return [];
    const row = part as { type?: unknown; text?: unknown };
    if (row.type !== "text" || typeof row.text !== "string") return [];
    const text = row.text.trim();
    return text ? [text] : [];
  });
}

/** Composer text plus inbox path notes from attachment `send()`. */
export function textFromAppendMessage(message: unknown): string {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return "";
  }
  const row = message as Record<string, unknown>;
  const seen = new Set<string>();
  const chunks: string[] = [];
  const push = (text: string) => {
    const next = text.trim();
    if (!next || seen.has(next)) return;
    seen.add(next);
    chunks.push(next);
  };
  if (typeof row.text === "string") push(row.text);
  if (typeof row.content === "string") push(row.content);
  else for (const text of textsFromParts(row.content)) push(text);
  for (const text of textsFromParts(row.parts)) push(text);
  if (Array.isArray(row.attachments)) {
    for (const attachment of row.attachments) {
      if (!attachment || typeof attachment !== "object") continue;
      for (const text of textsFromParts(
        (attachment as { content?: unknown }).content,
      )) {
        push(text);
      }
    }
  }
  return chunks.join("\n\n");
}

export function textFromOutgoingPayload(payload: unknown): string {
  return textFromAppendMessage(payload);
}

/** Stamp a send payload as a local user row so the bubble appears before the socket. */
export function seedOutgoingUserMessage(payload: unknown, id: string) {
  const text = textFromOutgoingPayload(payload);
  if (!text) return null;
  const metadata =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { metadata?: unknown }).metadata
      : undefined;
  return userBoundFromText({ id, content: text, metadata });
}
