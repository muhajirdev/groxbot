import { queryOptions } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { agentSocketHost } from "./host";
import { queryClient } from "./orpc";

const THINK_MESSAGES_KEY = ["think-messages"] as const;

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

export function setThinkMessages(botId: string, messages: UIMessage[]) {
  queryClient.setQueryData(thinkMessagesKey(botId), messages);
}

export function clearThinkMessages() {
  queryClient.removeQueries({ queryKey: THINK_MESSAGES_KEY });
}

export function thinkAgentHttpUrl(botId: string): string {
  const id = thinkAgentId(botId);
  const host = agentSocketHost();
  if (typeof window === "undefined") {
    return `https://${host ?? "api.groxbot.com"}/agents/bot-actor/${encodeURIComponent(id)}`;
  }
  const origin = host
    ? `${window.location.protocol}//${host}`
    : window.location.origin;
  return `${origin}/agents/bot-actor/${encodeURIComponent(id)}`;
}

/** `null` means the request failed; `[]` is a real empty thread. */
export async function fetchThinkMessages(
  agentHttpUrl: string | undefined,
): Promise<UIMessage[] | null> {
  if (!agentHttpUrl) return null;
  const messagesUrl = new URL(agentHttpUrl);
  messagesUrl.pathname += "/get-messages";
  try {
    const response = await fetch(messagesUrl, {
      credentials: "include",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const text = await response.text();
    if (!text.trim()) return [];
    return JSON.parse(text) as UIMessage[];
  } catch {
    return null;
  }
}

export const EMPTY_THINK_MESSAGES: UIMessage[] = [];

export function thinkMessagesQueryOptions(botId: string) {
  const id = thinkAgentId(botId);
  return queryOptions({
    queryKey: thinkMessagesKey(id),
    queryFn: async () => {
      const next = await fetchThinkMessages(thinkAgentHttpUrl(id));
      if (next === null) return peekThinkMessages(id) ?? EMPTY_THINK_MESSAGES;
      return next;
    },
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    retry: false,
  });
}
