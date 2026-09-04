import { apiOrigin } from "./host";

/** WebSocket to this bot's office chat Durable Object (Cap'n Web). */
export function officeRpcUrl(botId: string): string {
  const http = apiOrigin().replace(/\/$/, "");
  const ws = http.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return `${ws}/bots/${encodeURIComponent(botId)}/rpc`;
}
