import type { Bot } from "@groxbot/contracts";
import type { UIMessage } from "ai";
import { lastOfficePreview } from "./chat-messages";
import { orpc, queryClient } from "./orpc";

export const OFFICE_MESSAGES_ROOT = "office-messages" as const;
const OFFICE_MESSAGES_KEY = [OFFICE_MESSAGES_ROOT] as const;

/** Keep restored threads for the IndexedDB persist window. */
export const OFFICE_MESSAGES_GC_TIME = 7 * 24 * 60 * 60 * 1000;

/** Durable Object instance name: `bots.id`, same as Cap’n Web `/bots/:botId/rpc`. */
export function officeBotId(botId: string): string {
  const id = botId.trim();
  if (!id) throw new Error("office bot id required");
  return id;
}

export function officeMessagesKey(botId: string) {
  return [...OFFICE_MESSAGES_KEY, officeBotId(botId)] as const;
}

export function peekOfficeMessages(botId: string): UIMessage[] | undefined {
  return queryClient.getQueryData(officeMessagesKey(botId));
}

export function officePreviewsFromCache(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, data] of queryClient.getQueriesData<UIMessage[]>({
    queryKey: OFFICE_MESSAGES_KEY,
  })) {
    const id = key[1];
    if (typeof id !== "string" || !data) continue;
    const preview = lastOfficePreview(data);
    if (preview) out.set(id, preview);
  }
  return out;
}

function writeRosterPreview(botId: string, preview: string): void {
  if (!preview) return;
  const key = orpc.bots.list.queryOptions().queryKey;
  queryClient.setQueryData<Bot[]>(key, (current) => {
    if (!current) return current;
    let changed = false;
    const next = current.map((bot) => {
      if (bot.id !== botId || bot.lastPreview === preview) return bot;
      changed = true;
      return { ...bot, lastPreview: preview };
    });
    return changed ? next : current;
  });
}

export function setOfficeMessages(botId: string, messages: UIMessage[]) {
  queryClient.setQueryData(officeMessagesKey(botId), messages);
  writeRosterPreview(botId, lastOfficePreview(messages));
}

export function forgetOfficeMessages(botId: string) {
  queryClient.removeQueries({ queryKey: officeMessagesKey(botId) });
}

export function clearOfficeMessages() {
  queryClient.removeQueries({ queryKey: OFFICE_MESSAGES_KEY });
}
