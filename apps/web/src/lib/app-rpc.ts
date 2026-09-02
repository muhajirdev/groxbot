import { apiOrigin } from "./host";

/** WebSocket to the App Durable Object (Cap'n Web) on the API origin. */
export function appRpcUrl(appId: string): string {
  const http = apiOrigin().replace(/\/$/, "");
  const ws = http.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return `${ws}/apps/${encodeURIComponent(appId)}/rpc`;
}
