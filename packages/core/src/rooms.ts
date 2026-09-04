import type { WakeupJob } from "@groxbot/adapter-kit";
import { AvatarShape, type Room, type RoomMember } from "@groxbot/contracts";
import { bots, type Database, roomMembers, rooms } from "@groxbot/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { newId } from "./ids.js";
import type { OfficeChatMessage } from "./office-chat.js";
import { officeChatText, parseOfficeChatMessages } from "./office-chat.js";
import { iso } from "./threads.js";

export const ROOM_TURN_JOB = "room.turn";

export class RoomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoomError";
  }
}

export type RoomSeat = {
  id: string;
  name: string;
  title?: string;
  archivedAt?: Date | string | null;
};

export type RoomTurnPayload = {
  roomId: string;
  roomName: string;
  members: Array<{ id: string; name: string }>;
  messages: OfficeChatMessage[];
};

export function mentionFromText(text: string): string | null {
  const match = text.match(/(?:^|\s)@([A-Za-z0-9._-]+)/u);
  const name = match?.[1]?.trim();
  return name ? name : null;
}

export function resolveRoomTarget(
  members: readonly RoomSeat[],
  target?: { targetBotId?: string | null; mention?: string | null },
): RoomSeat {
  const live = members.filter((row) => !row.archivedAt);
  if (live.length === 0) {
    throw new RoomError("This room has no teammates.");
  }
  const needle = (target?.targetBotId ?? target?.mention ?? "").trim();
  if (live.length === 1 && !needle) {
    const only = live[0];
    if (only) return only;
  }
  if (!needle) {
    const names = live.map((row) => row.name).join(", ");
    throw new RoomError(
      `Name who should answer. Several people are at this table: ${names}.`,
    );
  }
  const lowered = needle.replace(/^@/u, "").toLowerCase();
  const match =
    live.find((row) => row.id === needle) ??
    live.find((row) => row.name.toLowerCase() === lowered);
  if (!match) {
    const archived = members.find((row) => {
      if (!row.archivedAt) return false;
      return row.id === needle || row.name.toLowerCase() === lowered;
    });
    if (archived) throw new RoomError(`${archived.name} is archived.`);
    const names = live.map((row) => row.name).join(", ");
    throw new RoomError(
      `${needle} is not in this room.${names ? ` Seated: ${names}.` : ""}`,
    );
  }
  return match;
}

export function roomTurnSystem(
  soul: string,
  room: {
    name: string;
    selfName: string;
    members: Array<{ name: string }>;
  },
): string {
  const seated = room.members.map((row) => row.name).join(", ");
  return `${soul.trim()}

You are ${room.selfName} at the table "${room.name}". Also here: ${seated || room.selfName}.
This log is the shared table, not your private office. Speak as yourself. Do not impersonate the others. Papers on the table are board files. Your computer is still yours.`;
}

export function roomWakeJob(input: {
  roomId: string;
  roomName: string;
  members: Array<{ id: string; name: string }>;
  messages: OfficeChatMessage[];
  targetBotId: string;
}): WakeupJob {
  return {
    botId: input.targetBotId,
    name: ROOM_TURN_JOB,
    payload: {
      roomId: input.roomId,
      roomName: input.roomName,
      members: input.members,
      messages: input.messages,
    },
  };
}

export function parseRoomTurnPayload(value: unknown): RoomTurnPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const roomId = typeof row.roomId === "string" ? row.roomId.trim() : "";
  const roomName = typeof row.roomName === "string" ? row.roomName.trim() : "";
  if (!roomId || !roomName) return null;
  if (!Array.isArray(row.members)) return null;
  const members = row.members.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const seat = item as { id?: unknown; name?: unknown };
    const id = typeof seat.id === "string" ? seat.id.trim() : "";
    const name = typeof seat.name === "string" ? seat.name.trim() : "";
    return id && name ? [{ id, name }] : [];
  });
  if (members.length === 0) return null;
  return {
    roomId,
    roomName,
    members,
    messages: parseOfficeChatMessages(row.messages),
  };
}

export function toRoomMemberDto(row: {
  id: string;
  name: string;
  title: string;
  avatarColor: string;
  avatarShape: string;
  archivedAt: Date | null;
}): RoomMember {
  const shape = AvatarShape.safeParse(row.avatarShape);
  return {
    botId: row.id,
    name: row.name,
    title: row.title,
    avatarColor: row.avatarColor,
    avatarShape: shape.success ? shape.data : "circle",
    archivedAt: iso(row.archivedAt),
  };
}

export function toRoomDto(
  room: typeof rooms.$inferSelect,
  members: RoomMember[],
  extras?: { lastPreview?: string; lastAt?: Date | string | null },
): Room {
  const lastAt =
    extras?.lastAt instanceof Date
      ? extras.lastAt.toISOString()
      : (extras?.lastAt ?? room.updatedAt.toISOString());
  return {
    id: room.id,
    workspaceId: room.workspaceId,
    name: room.name,
    members,
    lastPreview: extras?.lastPreview ?? "",
    lastAt,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}

export async function createRoom(
  db: Database,
  input: {
    workspaceId: string;
    userId: string;
    name: string;
    memberBotIds: string[];
    id?: string;
  },
): Promise<Room> {
  const name = input.name.trim();
  if (!name) throw new RoomError("Name this room.");
  const memberBotIds = [...new Set(input.memberBotIds.map((id) => id.trim()))];
  if (memberBotIds.length === 0) {
    throw new RoomError("Seat at least one teammate.");
  }
  const seated = await db
    .select({
      id: bots.id,
      name: bots.name,
      title: bots.title,
      avatarColor: bots.avatarColor,
      avatarShape: bots.avatarShape,
      archivedAt: bots.archivedAt,
    })
    .from(bots)
    .where(
      and(
        eq(bots.workspaceId, input.workspaceId),
        inArray(bots.id, memberBotIds),
      ),
    );
  const byId = new Map(seated.map((row) => [row.id, row]));
  for (const id of memberBotIds) {
    const bot = byId.get(id);
    if (!bot)
      throw new RoomError("Every seat must be a teammate in this office.");
    if (bot.archivedAt) throw new RoomError(`${bot.name} is archived.`);
  }
  const id = input.id?.trim() || newId();
  const [room] = await db
    .insert(rooms)
    .values({
      id,
      workspaceId: input.workspaceId,
      name,
      createdByUserId: input.userId,
    })
    .returning();
  if (!room) throw new RoomError("Could not create that room.");
  await db.insert(roomMembers).values(
    memberBotIds.map((botId) => ({
      id: newId(),
      roomId: room.id,
      botId,
    })),
  );
  return toRoomDto(
    room,
    memberBotIds.flatMap((botId) => {
      const bot = byId.get(botId);
      return bot ? [toRoomMemberDto(bot)] : [];
    }),
  );
}

export async function listRooms(
  db: Database,
  workspaceId: string,
): Promise<Room[]> {
  const rows = await db
    .select()
    .from(rooms)
    .where(eq(rooms.workspaceId, workspaceId))
    .orderBy(desc(rooms.updatedAt));
  if (rows.length === 0) return [];
  const seats = await db
    .select({
      roomId: roomMembers.roomId,
      id: bots.id,
      name: bots.name,
      title: bots.title,
      avatarColor: bots.avatarColor,
      avatarShape: bots.avatarShape,
      archivedAt: bots.archivedAt,
    })
    .from(roomMembers)
    .innerJoin(bots, eq(bots.id, roomMembers.botId))
    .where(
      inArray(
        roomMembers.roomId,
        rows.map((row) => row.id),
      ),
    );
  const membersByRoom = new Map<string, RoomMember[]>();
  for (const seat of seats) {
    const list = membersByRoom.get(seat.roomId) ?? [];
    list.push(toRoomMemberDto(seat));
    membersByRoom.set(seat.roomId, list);
  }
  return rows.map((row) => toRoomDto(row, membersByRoom.get(row.id) ?? []));
}

export async function getRoom(
  db: Database,
  workspaceId: string,
  roomId: string,
): Promise<Room | null> {
  const [room] = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.workspaceId, workspaceId)))
    .limit(1);
  if (!room) return null;
  const seats = await db
    .select({
      id: bots.id,
      name: bots.name,
      title: bots.title,
      avatarColor: bots.avatarColor,
      avatarShape: bots.avatarShape,
      archivedAt: bots.archivedAt,
    })
    .from(roomMembers)
    .innerJoin(bots, eq(bots.id, roomMembers.botId))
    .where(eq(roomMembers.roomId, room.id));
  return toRoomDto(room, seats.map(toRoomMemberDto));
}

export function liveRoomSeats(room: Pick<Room, "members">): RoomSeat[] {
  return room.members.map((row) => ({
    id: row.botId,
    name: row.name,
    title: row.title,
    archivedAt: row.archivedAt,
  }));
}

export function lastRoomPreview(
  messages: readonly OfficeChatMessage[],
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (!row) continue;
    const text = officeChatText(row);
    if (text) return text.slice(0, 140);
  }
  return "";
}
