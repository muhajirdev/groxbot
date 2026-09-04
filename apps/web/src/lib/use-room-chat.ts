import type { PiBoundMessage } from "@groxbot/core/browser";
import { roomRpcUrl } from "./room-chat-rpc";
import { usePiThread } from "./use-pi-thread";

export type RoomChatStatus = "ready" | "submitted" | "streaming" | "error";

export function useRoomChat(options: {
  roomId: string;
  targetBotId?: string;
  enabled?: boolean;
  seed?: PiBoundMessage[];
}) {
  return usePiThread({
    threadId: options.roomId,
    rpcUrl: roomRpcUrl(options.roomId),
    enabled: options.enabled,
    seed: options.seed,
    targetBotId: options.targetBotId,
  });
}
