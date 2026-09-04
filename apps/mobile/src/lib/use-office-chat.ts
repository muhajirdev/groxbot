import type { PiBoundMessage } from "@groxbot/core/browser";
import { officeRpcUrl } from "./host";
import { usePiThread } from "./use-pi-thread";

export type OfficeChatStatus = "ready" | "submitted" | "streaming" | "error";

export function useOfficeChat(options: {
  botId: string;
  enabled?: boolean;
  seed?: PiBoundMessage[];
  cookie?: string;
}) {
  const url = officeRpcUrl(options.botId);
  const cookie = options.cookie?.trim();
  const rpcUrl = cookie
    ? `${url}?Cookie=${encodeURIComponent(cookie)}`
    : url;
  return usePiThread({
    threadId: options.botId,
    rpcUrl,
    enabled: options.enabled,
    seed: options.seed,
  });
}
