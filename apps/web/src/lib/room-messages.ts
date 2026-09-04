import type { Room } from "@groxbot/contracts";
import {
  lastProjectedPreview,
  type PiBoundMessage,
  projectPiBoundMessages,
} from "@groxbot/core/browser";
import { orpc, queryClient } from "./orpc";

export const ROOM_MESSAGES_ROOT = "room-messages" as const;
const ROOM_MESSAGES_KEY = [ROOM_MESSAGES_ROOT] as const;

export function roomMessagesKey(roomId: string) {
  const id = roomId.trim();
  if (!id) throw new Error("room id required");
  return [...ROOM_MESSAGES_KEY, id] as const;
}

export function peekRoomMessages(roomId: string): PiBoundMessage[] | undefined {
  return queryClient.getQueryData(roomMessagesKey(roomId));
}

export function roomPreviewsFromCache(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, data] of queryClient.getQueriesData<PiBoundMessage[]>({
    queryKey: ROOM_MESSAGES_KEY,
  })) {
    const id = key[1];
    if (typeof id !== "string" || !data) continue;
    const preview = lastProjectedPreview(projectPiBoundMessages(data));
    if (preview) out.set(id, preview);
  }
  return out;
}

function writeRosterPreview(roomId: string, preview: string): void {
  if (!preview) return;
  const key = orpc.rooms.list.queryOptions().queryKey;
  queryClient.setQueryData<Room[]>(key, (current) => {
    if (!current) return current;
    let changed = false;
    const next = current.map((room) => {
      if (room.id !== roomId || room.lastPreview === preview) return room;
      changed = true;
      return { ...room, lastPreview: preview };
    });
    return changed ? next : current;
  });
}

export function setRoomMessages(roomId: string, messages: PiBoundMessage[]) {
  queryClient.setQueryData(roomMessagesKey(roomId), messages);
  writeRosterPreview(
    roomId,
    lastProjectedPreview(projectPiBoundMessages(messages)),
  );
}

export function forgetRoomMessages(roomId: string) {
  queryClient.removeQueries({ queryKey: roomMessagesKey(roomId) });
}

export function clearRoomMessages() {
  queryClient.removeQueries({ queryKey: ROOM_MESSAGES_KEY });
}

export function overlayRoomList(server: Room[]): Room[] {
  const previews = roomPreviewsFromCache();
  const cached = queryClient.getQueryData<Room[]>(
    orpc.rooms.list.queryOptions().queryKey,
  );
  const cachedById = new Map((cached ?? []).map((room) => [room.id, room]));
  let changed = false;
  const next = server.map((room) => {
    const lastPreview =
      previews.get(room.id) ||
      room.lastPreview ||
      cachedById.get(room.id)?.lastPreview ||
      "";
    if (lastPreview === room.lastPreview) return room;
    changed = true;
    return { ...room, lastPreview };
  });
  return changed ? next : server;
}

export function hydrateRoomPreviews(): void {
  const key = orpc.rooms.list.queryOptions().queryKey;
  const current = queryClient.getQueryData<Room[]>(key);
  if (!current) return;
  const next = overlayRoomList(current);
  if (next === current) return;
  queryClient.setQueryData(key, next);
}
