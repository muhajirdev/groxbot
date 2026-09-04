import type { AgentEvent, AgentMessage } from "@earendil-works/pi-agent-core";
import { Session } from "@earendil-works/pi-agent-core";
import type { OfficeChatMessage, PiBoundMessage } from "@groxbot/core";
import { jsonClone, officeChatToPiBound } from "@groxbot/core";

export const OFFICE_META_CUSTOM_TYPE = "office.meta";

type OfficeMetaData = {
  forId?: unknown;
  metadata?: unknown;
};

export function piBoundFromSessionEntries(
  entries: readonly import("@earendil-works/pi-agent-core").SessionTreeEntry[],
  custom: readonly import("@earendil-works/pi-agent-core").SessionTreeEntry[] = entries,
): PiBoundMessage[] {
  const metaById = new Map<string, unknown>();
  for (const entry of custom) {
    if (entry.type !== "custom" || entry.customType !== OFFICE_META_CUSTOM_TYPE) {
      continue;
    }
    const data = (entry.data ?? {}) as OfficeMetaData;
    if (typeof data.forId === "string" && data.forId) {
      metaById.set(data.forId, data.metadata);
    }
  }
  const out: PiBoundMessage[] = [];
  for (const entry of entries) {
    if (entry.type !== "message") continue;
    const row: PiBoundMessage = {
      id: entry.id,
      message: entry.message as PiBoundMessage["message"],
    };
    const metadata = metaById.get(entry.id);
    if (metadata !== undefined) row.metadata = metadata;
    out.push(row);
  }
  return out;
}

export async function persistOfficeSessionEvent(
  session: Session,
  event: AgentEvent,
  assistantId?: string,
): Promise<string | undefined> {
  if (event.type !== "message_end") return undefined;
  const message = jsonClone(event.message);
  if (!message || typeof message !== "object") return undefined;
  if (message.role === "toolResult") {
    return session.appendMessage(message as AgentMessage);
  }
  if (message.role !== "assistant") return undefined;
  if (!assistantId || (await session.getStorage().getEntry(assistantId))) {
    return session.appendMessage(message as AgentMessage);
  }
  await session.getStorage().appendEntry({
    type: "message",
    id: assistantId,
    parentId: await session.getStorage().getLeafId(),
    timestamp: new Date().toISOString(),
    message: message as AgentMessage,
  });
  return assistantId;
}

export async function appendOfficeUserText(
  session: Session,
  input: { id: string; content: string; metadata?: unknown },
): Promise<void> {
  const storage = session.getStorage();
  if (await storage.getEntry(input.id)) return;
  await storage.appendEntry({
    type: "message",
    id: input.id,
    parentId: await storage.getLeafId(),
    timestamp: new Date().toISOString(),
    message: {
      role: "user",
      content: input.content,
      timestamp: Date.now(),
    },
  });
  if (input.metadata !== undefined) {
    await session.appendCustomEntry(OFFICE_META_CUSTOM_TYPE, {
      forId: input.id,
      metadata: input.metadata,
    });
  }
}

export async function migrateOfficeChatToSession(
  session: Session,
  messages: readonly OfficeChatMessage[],
): Promise<void> {
  if (messages.length === 0) return;
  if ((await session.getEntries()).length > 0) return;
  const storage = session.getStorage();
  for (const row of officeChatToPiBound(messages)) {
    if (await storage.getEntry(row.id)) continue;
    await storage.appendEntry({
      type: "message",
      id: row.id,
      parentId: await storage.getLeafId(),
      timestamp: new Date().toISOString(),
      message: row.message as never,
    });
    if (row.metadata !== undefined) {
      await session.appendCustomEntry(OFFICE_META_CUSTOM_TYPE, {
        forId: row.id,
        metadata: row.metadata,
      });
    }
  }
}
