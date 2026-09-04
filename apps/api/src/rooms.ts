import type { Room } from "@groxbot/contracts";
import { createRoom, getRoom, listRooms, RoomError } from "@groxbot/core";
import { ORPCError } from "@orpc/server";
import type { RpcContext } from "./context.js";
import type { Actor } from "./session.js";

function asOrpc(error: unknown): never {
  if (error instanceof RoomError) {
    throw new ORPCError("BAD_REQUEST", { message: error.message });
  }
  throw error;
}

export async function listWorkspaceRooms(
  context: RpcContext,
  actor: Actor,
): Promise<Room[]> {
  return listRooms(context.db, actor.workspaceId);
}

export async function getWorkspaceRoom(
  context: RpcContext,
  actor: Actor,
  roomId: string,
): Promise<Room> {
  const room = await getRoom(context.db, actor.workspaceId, roomId);
  if (!room) {
    throw new ORPCError("NOT_FOUND", { message: "Room not found" });
  }
  return room;
}

export async function createWorkspaceRoom(
  context: RpcContext,
  actor: Actor,
  input: { id?: string; name: string; memberBotIds: string[] },
): Promise<Room> {
  let room: Room;
  try {
    room = await createRoom(context.db, {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      name: input.name,
      memberBotIds: input.memberBotIds,
      id: input.id,
    });
  } catch (error) {
    asOrpc(error);
  }
  if (context.initRoom) {
    await context.initRoom(room.id, {
      workspaceId: room.workspaceId,
      name: room.name,
      members: room.members.map((row) => ({
        id: row.botId,
        name: row.name,
        homeRoomId: row.homeRoomId,
      })),
    });
  }
  return room;
}
