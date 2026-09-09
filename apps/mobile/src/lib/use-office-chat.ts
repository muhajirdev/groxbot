import type { PiBoundMessage } from "@groxbot/core/browser";
import { officeRpcUrl } from "./host";
import { usePiThread } from "./use-pi-thread";

export type OfficeChatStatus = "ready" | "submitted" | "streaming" | "error";

export function useOfficeChat(options: {
  botId: string;
  roomId?: string;
  targetBotId?: string;
  enabled?: boolean;
  seed?: PiBoundMessage[];
  cookie?: string;
}) {
  const roomId = options.roomId || options.botId;
  const url = officeRpcUrl(roomId);
  const cookie = options.cookie?.trim();
  const rpcUrl = cookie
    ? `${url}?Cookie=${encodeURIComponent(cookie)}`
    : url;
  return usePiThread({
    threadId: roomId,
    rpcUrl,
    enabled: options.enabled,
    seed: options.seed,
    targetBotId: options.targetBotId,
  });
}
