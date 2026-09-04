import type { PiBoundMessage } from "@groxbot/core/browser";
import { officeRpcUrl } from "./office-chat-rpc";
import { usePiThread } from "./use-pi-thread";

export type OfficeChatStatus = "ready" | "submitted" | "streaming" | "error";

export function useOfficeChat(options: {
  botId: string;
  enabled?: boolean;
  seed?: PiBoundMessage[];
}) {
  return usePiThread({
    threadId: options.botId,
    rpcUrl: officeRpcUrl(options.botId),
    enabled: options.enabled,
    seed: options.seed,
  });
}
