import type { Bot } from "@groxbot/contracts";
import type { UIMessage } from "ai";
import { lastThinkPreview } from "./chat-messages";
import { orpc, queryClient } from "./orpc";

export const THINK_MESSAGES_ROOT = "think-messages" as const;
const THINK_MESSAGES_KEY = [THINK_MESSAGES_ROOT] as const;

/** Keep restored threads for the IndexedDB persist window. */
export const THINK_MESSAGES_GC_TIME = 7 * 24 * 60 * 60 * 1000;

/** Durable Object instance name: `bots.id`, same as `useAgent({ name })`. */
export function thinkAgentId(botId: string): string {
  const id = botId.trim();
  if (!id) throw new Error("think agent id required");
  return id;
}

export function thinkMessagesKey(botId: string) {
  return [...THINK_MESSAGES_KEY, thinkAgentId(botId)] as const;
}

export function peekThinkMessages(botId: string): UIMessage[] | undefined {
  return queryClient.getQueryData(thinkMessagesKey(botId));
}

export function thinkPreviewsFromCache(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, data] of queryClient.getQueriesData<UIMessage[]>({
    queryKey: THINK_MESSAGES_KEY,
  })) {
    const id = key[1];
    if (typeof id !== "string" || !data) continue;
    const preview = lastThinkPreview(data);
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

export function setThinkMessages(botId: string, messages: UIMessage[]) {
  queryClient.setQueryData(thinkMessagesKey(botId), messages);
  writeRosterPreview(botId, lastThinkPreview(messages));
}

export function forgetThinkMessages(botId: string) {
  queryClient.removeQueries({ queryKey: thinkMessagesKey(botId) });
}

export function clearThinkMessages() {
  queryClient.removeQueries({ queryKey: THINK_MESSAGES_KEY });
}
