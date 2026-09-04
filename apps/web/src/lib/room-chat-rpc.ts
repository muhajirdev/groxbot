import { apiOrigin } from "./host";

/** WebSocket to this room’s Cap’n Web Durable Object. */
export function roomRpcUrl(roomId: string): string {
  const http = apiOrigin().replace(/\/$/, "");
  const ws = http.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return `${ws}/rooms/${encodeURIComponent(roomId)}/rpc`;
}
