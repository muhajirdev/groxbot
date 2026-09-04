import type {
  PiAgentMessage,
  PiAssistantMessage,
  PiBoundMessage,
} from "./pi-transcript.js";
import { piUserText } from "./pi-transcript.js";
import {
  firstLiveSeatName,
  mentionFromText,
  type RoomSeat,
} from "./room-target.js";

export type RoomSpeaker = {
  botId: string;
  name: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function roomSpeakerKey(metadata: unknown): string {
  return parseRoomSpeaker(metadata)?.botId ?? "";
}

export function parseRoomSpeaker(metadata: unknown): RoomSpeaker | null {
  const row = asRecord(metadata);
  if (!row) return null;
  const nested = asRecord(row.custom);
  const raw = asRecord(row.speaker) ?? asRecord(nested?.speaker);
  if (!raw) return null;
  const botId = typeof raw.botId === "string" ? raw.botId.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!botId || !name) return null;
  return { botId, name };
}

export function withRoomSpeaker(
  metadata: unknown,
  seat: { id: string; name: string },
): Record<string, unknown> {
  const prev = asRecord(metadata) ?? {};
  const custom = asRecord(prev.custom) ?? {};
  const speaker: RoomSpeaker = { botId: seat.id, name: seat.name };
  return { ...prev, speaker, custom: { ...custom, speaker } };
}

function assistantPlainText(message: PiAssistantMessage): string {
  return message.content
    .flatMap((part) =>
      part.type === "text" && part.text.trim() ? [part.text.trim()] : [],
    )
    .join("\n")
    .trim();
}

/** Other people’s turns become named user lines so this seat does not own them. */
export function piGroupLoopMessages(
  messages: readonly PiBoundMessage[],
  selfId: string,
): PiAgentMessage[] {
  const out: PiAgentMessage[] = [];
  let skipTools = false;
  for (const row of messages) {
    const message = row.message;
    if (message.role === "user") {
      skipTools = false;
      out.push(message);
      continue;
    }
    if (message.role === "toolResult") {
      if (!skipTools) out.push(message);
      continue;
    }
    if (message.role !== "assistant") continue;
    const speaker = parseRoomSpeaker(row.metadata);
    if (!speaker || speaker.botId === selfId) {
      skipTools = false;
      out.push(message);
      continue;
    }
    skipTools = true;
    const text = assistantPlainText(message);
    if (!text) continue;
    out.push({
      role: "user",
      content: `${speaker.name}: ${text}`,
      timestamp: message.timestamp,
    });
  }
  return out;
}

function seatName(
  members: readonly RoomSeat[],
  botId: string | null | undefined,
): string {
  const id = (botId ?? "").trim();
  if (!id) return "";
  return members.find((row) => row.id === id && !row.archivedAt)?.name ?? "";
}

/** Who the table should name while a turn is in flight. Never the room title. */
export function roomWorkingName(
  messages: readonly PiBoundMessage[],
  members: readonly RoomSeat[],
  target?: { targetBotId?: string | null; floorBotId?: string | null },
): string {
  const floorName = seatName(members, target?.floorBotId);

  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (!row) continue;
    const role = row.message.role;
    if (role === "toolResult") continue;
    if (role === "assistant") {
      const name = parseRoomSpeaker(row.metadata)?.name;
      const stop =
        row.message.role === "assistant"
          ? (row.message as PiAssistantMessage).stopReason
          : undefined;
      const finished = Boolean(stop && stop !== "toolUse");
      if (finished && floorName) return floorName;
      if (name) return name;
      continue;
    }
    if (role === "user") {
      const mention = mentionFromText(
        piUserText(row.message),
        members.map((seat) => seat.name),
      );
      const focused = (target?.targetBotId ?? "").trim();
      if (mention || focused) {
        return firstLiveSeatName(members, {
          targetBotId: focused,
          mention,
        });
      }
      return floorName;
    }
  }
  const focused = (target?.targetBotId ?? "").trim();
  if (focused) return firstLiveSeatName(members, { targetBotId: focused });
  return floorName;
}
