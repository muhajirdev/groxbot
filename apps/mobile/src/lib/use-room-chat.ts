import type { PiBoundMessage } from "@groxbot/core/browser";
import { officeRpcUrl } from "./host";
import { usePiThread } from "./use-pi-thread";

export function useRoomChat(options: {
  roomId: string;
  targetBotId?: string;
  enabled?: boolean;
  seed?: PiBoundMessage[];
  cookie?: string;
}) {
  const url = officeRpcUrl(options.roomId);
  const cookie = options.cookie?.trim();
  const rpcUrl = cookie
    ? `${url}?Cookie=${encodeURIComponent(cookie)}`
    : url;
  return usePiThread({
    threadId: options.roomId,
    rpcUrl,
    enabled: options.enabled,
    seed: options.seed,
    targetBotId: options.targetBotId,
  });
}
