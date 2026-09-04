import {
  presentPreviewFromParts,
  withOfficeUserMetadata,
} from "@groxbot/contracts";
import { officeUserMessageSender } from "./office-sender";

export type OfficeRole = "user" | "assistant" | "system";

export type OfficePart = {
  type: string;
  text?: string;
  [key: string]: unknown;
};

export type OfficeMessage = {
  id: string;
  role: OfficeRole;
  parts: OfficePart[];
  metadata?: unknown;
};

const FILE_NOTE = "On this computer:";

export function isComputerFileNote(text: string): boolean {
  return (
    text.startsWith(`${FILE_NOTE} `) ||
    /^Saved on this computer as \S/u.test(text)
  );
}

function isTextPart(part: OfficePart): part is OfficePart & { text: string } {
  return part.type === "text" && typeof part.text === "string";
}

export function textFromOfficeMessage(message: OfficeMessage): string {
  return message.parts
    .filter(isTextPart)
    .map((part) => part.text)
    .join("");
}

export function visibleTextFromOfficeMessage(message: OfficeMessage): string {
  return message.parts
    .filter(isTextPart)
    .map((part) => part.text)
    .filter((text) => !isComputerFileNote(text))
    .join("");
}

export function usedTools(message: OfficeMessage): boolean {
  return message.parts.some(
    (part) => part.type.startsWith("tool-") || part.type === "dynamic-tool",
  );
}

export function isVisibleOfficeMessage(message: OfficeMessage): boolean {
  if (message.role === "user") {
    return visibleTextFromOfficeMessage(message).trim().length > 0;
  }
  return textFromOfficeMessage(message).trim().length > 0 || usedTools(message);
}

export function lastOfficePreview(messages: OfficeMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (!row) continue;
    const text = visibleTextFromOfficeMessage(row).replace(/\s+/g, " ").trim();
    if (text) return text.slice(0, 140);
    const presented = presentPreviewFromParts(row.parts);
    if (presented) return presented;
  }
  return "";
}

export function parseOfficeMessages(payload: unknown): OfficeMessage[] {
  if (!Array.isArray(payload)) return [];
  const out: OfficeMessage[] = [];
  for (const row of payload) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const role = item.role;
    if (!id || (role !== "user" && role !== "assistant" && role !== "system")) {
      continue;
    }
    const parts = Array.isArray(item.parts)
      ? item.parts.filter(
          (part): part is OfficePart =>
            Boolean(part) && typeof part === "object" && "type" in part,
        )
      : [];
    out.push({
      id,
      role,
      parts,
      metadata: item.metadata,
    });
  }
  return out;
}

function lastAssistantIndex(messages: OfficeMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "assistant") return i;
  }
  return -1;
}

function withAssistantText(
  messages: OfficeMessage[],
  delta: string,
  messageId?: string,
): OfficeMessage[] {
  const next = messages.slice();
  let index = lastAssistantIndex(next);
  const id = messageId?.trim() || next[index]?.id || newOfficeId("a");
  if (index < 0 || (messageId && next[index]?.id !== messageId)) {
    const existing = next.findIndex((row) => row.id === id);
    if (existing >= 0) index = existing;
    else {
      next.push({ id, role: "assistant", parts: [{ type: "text", text: "" }] });
      index = next.length - 1;
    }
  }
  const current = next[index];
  if (!current) return next;
  const parts = current.parts.slice();
  let textIndex = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]?.type === "text") {
      textIndex = i;
      break;
    }
  }
  if (textIndex < 0) {
    parts.push({ type: "text", text: delta });
  } else {
    const part = parts[textIndex];
    if (!part) {
      parts.push({ type: "text", text: delta });
    } else {
      parts[textIndex] = { ...part, text: `${part.text ?? ""}${delta}` };
    }
  }
  next[index] = { ...current, id, parts };
  return next;
}

export function applyOfficeChunk(
  messages: OfficeMessage[],
  chunk: Record<string, unknown>,
): OfficeMessage[] {
  const type = String(chunk.type ?? "");
  const messageId =
    typeof chunk.messageId === "string"
      ? chunk.messageId
      : typeof chunk.id === "string"
        ? chunk.id
        : undefined;
  if (type === "start" || type === "text-start") {
    const id = messageId || newOfficeId("a");
    if (messages.some((row) => row.id === id)) return messages;
    return [
      ...messages,
      { id, role: "assistant", parts: [{ type: "text", text: "" }] },
    ];
  }
  if (type === "text-delta") {
    const delta = String(chunk.delta ?? chunk.text ?? "");
    if (!delta) return messages;
    return withAssistantText(messages, delta, messageId);
  }
  return messages;
}

export function applyOfficeSocketMessage(
  messages: OfficeMessage[],
  payload: unknown,
): { messages: OfficeMessage[]; streaming: boolean; error?: string } {
  if (!payload || typeof payload !== "object") {
    return { messages, streaming: false };
  }
  const row = payload as Record<string, unknown>;
  const type = String(row.type ?? "");
  if (type === "cf_agent_chat_messages" && Array.isArray(row.messages)) {
    return { messages: parseOfficeMessages(row.messages), streaming: false };
  }
  if (type === "cf_agent_use_chat_response") {
    if (row.error) {
      return {
        messages,
        streaming: false,
        error: String(row.body || "Stream error"),
      };
    }
    let next = messages;
    if (typeof row.body === "string" && row.body.trim()) {
      try {
        const chunk = JSON.parse(row.body) as Record<string, unknown>;
        next = applyOfficeChunk(messages, chunk);
      } catch {
        next = messages;
      }
    }
    return { messages: next, streaming: row.done !== true };
  }
  return { messages, streaming: false };
}

export function newOfficeId(prefix = "m"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function userOfficeMessage(input: {
  text: string;
  userId?: string;
  userName?: string;
}): OfficeMessage {
  const sender =
    input.userId && input.userName
      ? { userId: input.userId, name: input.userName }
      : null;
  const stamped = withOfficeUserMetadata({ metadata: undefined }, sender) as {
    metadata?: unknown;
  };
  return {
    id: newOfficeId("u"),
    role: "user",
    parts: [{ type: "text", text: input.text }],
    metadata: stamped.metadata,
  };
}

export function officeSendBody(messages: OfficeMessage[]): string {
  return JSON.stringify({
    messages,
    trigger: "submit-message",
  });
}

export { officeUserMessageSender };
