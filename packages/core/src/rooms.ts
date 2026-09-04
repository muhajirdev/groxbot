import type { WakeupJob } from "@groxbot/adapter-kit";
import { AvatarShape, type Room, type RoomMember } from "@groxbot/contracts";
import { bots, type Database, roomMembers, rooms } from "@groxbot/db";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { newId } from "./ids.js";
import type { PiBoundMessage } from "./pi-transcript.js";
import { parsePiLogMessages, piUserText } from "./pi-transcript.js";
import { iso } from "./threads.js";
import { RoomError, type RoomSeat } from "./room-target.js";
import { parseVisibility } from "./visibility.js";

export {
  RoomError,
  firstLiveSeatName,
  mentionFromText,
  resolveRoomTarget,
  resolveRoomTargets,
  type RoomSeat,
} from "./room-target.js";

export const ROOM_TURN_JOB = "room.turn";

/** Shared rooms only seat shared teammates. */
export function assertInvitableToSharedRoom(bot: {
  name: string;
  visibility: string;
}): void {
  if (parseVisibility(bot.visibility) === "private") {
    throw new RoomError(
      `${bot.name} is private and can't join a shared room.`,
    );
  }
}

/** Listing hides rooms that are someone’s `bots.homeRoomId`. */
export function isListedGroupRoom(
  roomId: string,
  homeRoomIds: Iterable<string | null | undefined>,
): boolean {
  for (const id of homeRoomIds) {
    if (id === roomId) return false;
  }
  return true;
}

/** Home rooms are a person’s office. Delete only listed groups. */
export function assertDeletableGroupRoom(
  roomId: string,
  homeRoomIds: Iterable<string | null | undefined>,
): void {
  if (!isListedGroupRoom(roomId, homeRoomIds)) {
    throw new RoomError("That's someone's office, not a group.");
  }
}

export type RoomTurnPayload = {
  roomId: string;
  roomName: string;
  members: Array<{ id: string; name: string }>;
  messages: PiBoundMessage[];
};

export function roomTurnSystem(
  soul: string,
  room: {
    name: string;
    selfName: string;
    members: Array<{ name: string }>;
    around?: boolean;
  },
): string {
  const seated = room.members.map((row) => row.name).join(", ");
  const around = room.around
    ? " The table is going around — everyone here will answer. Keep it short. Do not recap the others."
    : "";
  return `${soul.trim()}

You are ${room.selfName} at the table "${room.name}". Also here: ${seated || room.selfName}.
This log is the shared table, not your private office. Speak as yourself. Do not impersonate the others.${around} Papers on the table are this room’s files. Your computer is still yours.`;
}

export function roomWakeJob(input: {
  roomId: string;
  roomName: string;
  members: Array<{ id: string; name: string; homeRoomId?: string }>;
  messages: PiBoundMessage[];
  targetBotId: string;
  targetHomeRoomId: string;
}): WakeupJob {
  return {
    botId: input.targetBotId,
    name: ROOM_TURN_JOB,
    payload: {
      roomId: input.roomId,
      roomName: input.roomName,
      members: input.members,
      messages: input.messages,
      homeRoomId: input.targetHomeRoomId,
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
    messages: parsePiLogMessages(row.messages),
  };
}

export function toRoomMemberDto(row: {
  id: string;
  name: string;
  title: string;
  avatarColor: string;
  avatarShape: string;
  archivedAt: Date | null;
  homeRoomId: string | null;
}): RoomMember {
  const shape = AvatarShape.safeParse(row.avatarShape);
  return {
    botId: row.id,
    homeRoomId: row.homeRoomId ?? "",
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
    /** Hire: this room is that bot’s own. Listing hides it via `homeRoomId`. */
    own?: boolean;
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
      homeRoomId: bots.homeRoomId,
      visibility: bots.visibility,
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
    if (!input.own && bot.archivedAt) {
      throw new RoomError(`${bot.name} is archived.`);
    }
    if (!input.own) assertInvitableToSharedRoom(bot);
    if (!input.own && !bot.homeRoomId) {
      throw new RoomError(`${bot.name} has no room yet.`);
    }
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
      return bot
        ? [
            toRoomMemberDto({
              ...bot,
              homeRoomId: input.own ? id : (bot.homeRoomId ?? ""),
            }),
          ]
        : [];
    }),
  );
}

/** Teammates hired before home rooms get a room on first list/get. */
export async function ensureBotOwnRoom(
  db: Database,
  input: {
    workspaceId: string;
    userId: string;
    botId: string;
    name: string;
    homeRoomId?: string | null;
  },
): Promise<string> {
  const existing = input.homeRoomId?.trim();
  if (existing) return existing;
  const home = await createRoom(db, {
    workspaceId: input.workspaceId,
    userId: input.userId,
    name: input.name,
    memberBotIds: [input.botId],
    own: true,
  });
  await db
    .update(bots)
    .set({ homeRoomId: home.id, updatedAt: new Date() })
    .where(eq(bots.id, input.botId));
  return home.id;
}

export async function listRooms(
  db: Database,
  workspaceId: string,
): Promise<Room[]> {
  const rows = await db
    .select({ room: rooms })
    .from(rooms)
    .leftJoin(bots, eq(bots.homeRoomId, rooms.id))
    .where(and(eq(rooms.workspaceId, workspaceId), isNull(bots.id)))
    .orderBy(desc(rooms.updatedAt));
  const listed = rows.map((row) => row.room);
  if (listed.length === 0) return [];
  const seats = await db
    .select({
      roomId: roomMembers.roomId,
      id: bots.id,
      name: bots.name,
      title: bots.title,
      avatarColor: bots.avatarColor,
      avatarShape: bots.avatarShape,
      archivedAt: bots.archivedAt,
      homeRoomId: bots.homeRoomId,
    })
    .from(roomMembers)
    .innerJoin(bots, eq(bots.id, roomMembers.botId))
    .where(
      inArray(
        roomMembers.roomId,
        listed.map((row) => row.id),
      ),
    );
  const membersByRoom = new Map<string, RoomMember[]>();
  for (const seat of seats) {
    const list = membersByRoom.get(seat.roomId) ?? [];
    list.push(toRoomMemberDto(seat));
    membersByRoom.set(seat.roomId, list);
  }
  return listed.map((row) => toRoomDto(row, membersByRoom.get(row.id) ?? []));
}

export async function deleteRoom(
  db: Database,
  workspaceId: string,
  roomId: string,
): Promise<{ ok: true }> {
  const [row] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new RoomError("That room is missing.");
  const [home] = await db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.homeRoomId, roomId), eq(bots.workspaceId, workspaceId)))
    .limit(1);
  assertDeletableGroupRoom(roomId, home ? [roomId] : []);
  await db
    .delete(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.workspaceId, workspaceId)));
  return { ok: true };
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
      homeRoomId: bots.homeRoomId,
    })
    .from(roomMembers)
    .innerJoin(bots, eq(bots.id, roomMembers.botId))
    .where(eq(roomMembers.roomId, room.id));
  return toRoomDto(room, seats.map(toRoomMemberDto));
}

/** Private teammates cannot sit at a group table. Home office stays. */
export async function unseatBotFromGroups(
  db: Database,
  botId: string,
  homeRoomId: string | null,
): Promise<string[]> {
  const seats = await db
    .select({ id: roomMembers.id, roomId: roomMembers.roomId })
    .from(roomMembers)
    .where(
      homeRoomId
        ? and(eq(roomMembers.botId, botId), ne(roomMembers.roomId, homeRoomId))
        : eq(roomMembers.botId, botId),
    );
  if (seats.length === 0) return [];
  await db.delete(roomMembers).where(
    inArray(
      roomMembers.id,
      seats.map((row) => row.id),
    ),
  );
  return [...new Set(seats.map((row) => row.roomId))];
}

export function liveRoomSeats(room: Pick<Room, "members">): RoomSeat[] {
  return room.members.map((row) => ({
    id: row.botId,
    homeRoomId: row.homeRoomId,
    name: row.name,
    title: row.title,
    archivedAt: row.archivedAt,
  }));
}

export function lastRoomPreview(messages: readonly PiBoundMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (!row) continue;
    const text = piUserText(row.message) || assistantText(row.message);
    if (text) return text.slice(0, 140);
  }
  return "";
}

function assistantText(message: PiBoundMessage["message"]): string {
  if (message.role !== "assistant" || !Array.isArray(message.content)) return "";
  return message.content
    .flatMap((part) =>
      part && typeof part === "object" && part.type === "text" && part.text
        ? [part.text]
        : [],
    )
    .join("")
    .trim();
}
