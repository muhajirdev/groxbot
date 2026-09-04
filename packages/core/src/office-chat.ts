/** Office home-thread log. Durable rows are JSON UIMessages. */

export const OFFICE_CHAT_STATUSES = [
  "ready",
  "submitted",
  "streaming",
  "error",
] as const;

export type OfficeChatStatus = (typeof OFFICE_CHAT_STATUSES)[number];

export type OfficeChatPart = {
  type: string;
  [key: string]: unknown;
};

export type OfficeChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: OfficeChatPart[];
  metadata?: unknown;
  createdAt?: number;
};

export const OFFICE_WORKSPACE_HEADER = "x-groxbot-workspace";
export const OFFICE_GENERATION_STORAGE = "officeGeneration";
export const OFFICE_CHAT_TABLE = "office_chat";

export function isOfficeChatStatus(value: unknown): value is OfficeChatStatus {
  return (
    value === "ready" ||
    value === "submitted" ||
    value === "streaming" ||
    value === "error"
  );
}

export function parseOfficeChatPart(value: unknown): OfficeChatPart | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const type = (value as { type?: unknown }).type;
  if (typeof type !== "string" || !type) return null;
  return value as OfficeChatPart;
}

export function parseOfficeChatMessage(
  value: unknown,
): OfficeChatMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!id) return null;
  const role = row.role;
  if (role !== "user" && role !== "assistant" && role !== "system") return null;
  const parts = Array.isArray(row.parts)
    ? row.parts.flatMap((part) => {
        const parsed = parseOfficeChatPart(part);
        return parsed ? [parsed] : [];
      })
    : [];
  const createdAt =
    typeof row.createdAt === "number" && Number.isFinite(row.createdAt)
      ? row.createdAt
      : typeof row.createdAt === "string"
        ? Date.parse(row.createdAt)
        : undefined;
  const message: OfficeChatMessage = {
    id,
    role,
    parts,
  };
  if (row.metadata !== undefined) message.metadata = row.metadata;
  if (createdAt !== undefined && Number.isFinite(createdAt)) {
    message.createdAt = createdAt;
  }
  return message;
}

export function parseOfficeChatMessages(value: unknown): OfficeChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const parsed = parseOfficeChatMessage(row);
    return parsed ? [parsed] : [];
  });
}

export function officeChatText(message: {
  parts?: unknown;
  content?: unknown;
}): string {
  const fromParts = officePartsText(message.parts);
  if (fromParts) return fromParts;
  return modelContentText(message.content);
}

function officePartsText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  const chunks: string[] = [];
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const row = part as { type?: unknown; text?: unknown };
    if (row.type === "text" && typeof row.text === "string" && row.text) {
      chunks.push(row.text);
    }
  }
  return chunks.join("").trim();
}

function modelContentText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  const chunks: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const row = part as { type?: unknown; text?: unknown };
    if (row.type === "text" && typeof row.text === "string") {
      chunks.push(row.text);
    }
  }
  return chunks.join("").trim();
}

export function lastOfficeUserMessage(
  messages: readonly OfficeChatMessage[],
): OfficeChatMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (row?.role === "user") return row;
  }
  return null;
}

/** Start a Pi turn when the log ends on a user row. */
export function officeChatShouldRun(
  messages: readonly OfficeChatMessage[],
): boolean {
  const last = messages.at(-1);
  return last?.role === "user";
}

export function upsertOfficeChatMessage(
  messages: readonly OfficeChatMessage[],
  next: OfficeChatMessage,
): OfficeChatMessage[] {
  const index = messages.findIndex((row) => row.id === next.id);
  if (index < 0) return [...messages, next];
  const copy = messages.slice();
  copy[index] = next;
  return copy;
}

export function dropLastAssistant(
  messages: readonly OfficeChatMessage[],
): OfficeChatMessage[] {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return [...messages];
  return messages.slice(0, -1);
}

export function nextOfficeGeneration(current: unknown): number {
  const n =
    typeof current === "number" && Number.isFinite(current)
      ? Math.floor(current)
      : 0;
  return n > 0 ? n + 1 : 1;
}

export function toolNameFromPart(part: OfficeChatPart): string | null {
  if (part.type === "dynamic-tool") {
    return typeof part.toolName === "string" && part.toolName
      ? part.toolName
      : null;
  }
  if (part.type.startsWith("tool-") && part.type !== "tool-approval") {
    return part.type.slice("tool-".length);
  }
  return null;
}

export function stringifyToolOutput(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
