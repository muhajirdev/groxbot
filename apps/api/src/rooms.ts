import type { Room } from "@groxbot/contracts";
import {
  createRoom,
  deleteRoom,
  getRoom,
  inviteRoomMembers,
  listRooms,
  RoomError,
  updateRoom,
} from "@groxbot/core";
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
  input: {
    id?: string;
    name: string;
    memberBotIds: string[];
    status?: Room["status"];
    description?: string;
  },
): Promise<Room> {
  let room: Room;
  try {
    room = await createRoom(context.db, {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      name: input.name,
      memberBotIds: input.memberBotIds,
      id: input.id,
      status: input.status,
      description: input.description,
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

export async function updateWorkspaceRoom(
  context: RpcContext,
  actor: Actor,
  input: {
    roomId: string;
    name?: string;
    description?: string;
    status?: Room["status"];
  },
): Promise<Room> {
  try {
    return await updateRoom(context.db, {
      workspaceId: actor.workspaceId,
      roomId: input.roomId,
      name: input.name,
      description: input.description,
      status: input.status,
    });
  } catch (error) {
    if (
      error instanceof RoomError &&
      error.message === "That room is missing."
    ) {
      throw new ORPCError("NOT_FOUND", { message: "Room not found" });
    }
    asOrpc(error);
  }
}

export async function inviteWorkspaceRoomMembers(
  context: RpcContext,
  actor: Actor,
  input: { roomId: string; memberBotIds: string[] },
): Promise<Room> {
  let room: Room;
  try {
    room = await inviteRoomMembers(context.db, {
      workspaceId: actor.workspaceId,
      roomId: input.roomId,
      memberBotIds: input.memberBotIds,
    });
  } catch (error) {
    if (
      error instanceof RoomError &&
      error.message === "That room is missing."
    ) {
      throw new ORPCError("NOT_FOUND", { message: "Room not found" });
    }
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

export async function deleteWorkspaceRoom(
  context: RpcContext,
  actor: Actor,
  roomId: string,
): Promise<{ ok: true }> {
  try {
    await deleteRoom(context.db, actor.workspaceId, roomId);
  } catch (error) {
    if (
      error instanceof RoomError &&
      error.message === "That room is missing."
    ) {
      throw new ORPCError("NOT_FOUND", { message: "Room not found" });
    }
    asOrpc(error);
  }
  try {
    await context.forgetBot?.(roomId);
  } catch (error) {
    console.error("room actor destroy", roomId, error);
  }
  return { ok: true };
}
