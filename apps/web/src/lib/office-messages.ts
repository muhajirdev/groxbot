import type { Bot } from "@groxbot/contracts";
import {
  lastProjectedPreview,
  type PiBoundMessage,
  projectPiBoundMessages,
} from "@groxbot/core/browser";
import { orpc, queryClient } from "./orpc";

export const OFFICE_MESSAGES_ROOT = "office-messages" as const;
const OFFICE_MESSAGES_KEY = [OFFICE_MESSAGES_ROOT] as const;

/** Keep restored threads for the IndexedDB persist window. */
export const OFFICE_MESSAGES_GC_TIME = 7 * 24 * 60 * 60 * 1000;

/** Durable Object instance name: home `roomId`, same as Cap’n Web `/rooms/:roomId/rpc`. */
export function officeBotId(roomId: string): string {
  const id = roomId.trim();
  if (!id) throw new Error("office bot id required");
  return id;
}

export function officeMessagesKey(roomId: string) {
  return [...OFFICE_MESSAGES_KEY, officeBotId(roomId)] as const;
}

export function peekOfficeMessages(roomId: string): PiBoundMessage[] | undefined {
  return queryClient.getQueryData(officeMessagesKey(roomId));
}

export function officePreviewsFromCache(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, data] of queryClient.getQueriesData<PiBoundMessage[]>({
    queryKey: OFFICE_MESSAGES_KEY,
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
  const key = orpc.bots.list.queryOptions().queryKey;
  queryClient.setQueryData<Bot[]>(key, (current) => {
    if (!current) return current;
    let changed = false;
    const next = current.map((bot) => {
      const match = bot.homeRoomId === roomId || bot.id === roomId;
      if (!match || bot.lastPreview === preview) return bot;
      changed = true;
      return { ...bot, lastPreview: preview };
    });
    return changed ? next : current;
  });
}

export function setOfficeMessages(roomId: string, messages: PiBoundMessage[]) {
  queryClient.setQueryData(officeMessagesKey(roomId), messages);
  writeRosterPreview(
    roomId,
    lastProjectedPreview(projectPiBoundMessages(messages)),
  );
}

export function forgetOfficeMessages(roomId: string) {
  queryClient.removeQueries({ queryKey: officeMessagesKey(roomId) });
}

export function clearOfficeMessages() {
  queryClient.removeQueries({ queryKey: OFFICE_MESSAGES_KEY });
}
