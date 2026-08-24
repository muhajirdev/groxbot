import { apiOrigin } from "./host";

/** WebSocket to the App Durable Object (Cap'n Web). Same-origin in Vite via /apps proxy. */
export function appRpcUrl(appId: string): string {
  const http = apiOrigin().replace(/\/$/, "");
  const ws = http.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return `${ws}/apps/${encodeURIComponent(appId)}/rpc`;
}
