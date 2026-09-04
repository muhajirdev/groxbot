import { apiOrigin } from "./host";

/** WebSocket to this conversation’s RoomActor (person or group). */
export function officeRpcUrl(roomId: string): string {
  const http = apiOrigin().replace(/\/$/, "");
  const ws = http.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return `${ws}/rooms/${encodeURIComponent(roomId)}/rpc`;
}
