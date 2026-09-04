import { CLOUD_API_ORIGIN, CLOUD_WEB_ORIGIN } from "@groxbot/contracts";

const LOCAL_API_ORIGIN = "http://127.0.0.1:3100";
const LOCAL_WEB_ORIGIN = "http://127.0.0.1:5173";

/** Origin of the API Worker. On a device, set EXPO_PUBLIC_API_URL to this machine’s LAN address. */
export function apiOrigin(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.NODE_ENV === "production") return CLOUD_API_ORIGIN;
  return LOCAL_API_ORIGIN;
}

/** Office SPA. Live docs / slides / sheets still open here. */
export function webOrigin(): string {
  const explicit = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.NODE_ENV === "production") return CLOUD_WEB_ORIGIN;
  return LOCAL_WEB_ORIGIN;
}

export function agentSocketHost(origin = apiOrigin()): {
  host: string;
  secure: boolean;
} {
  const url = new URL(origin);
  return {
    host: url.host,
    secure: url.protocol === "https:",
  };
}

export function officeRpcUrl(roomId: string, origin = apiOrigin()): string {
  const http = origin.replace(/\/$/, "");
  const ws = http.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return `${ws}/rooms/${encodeURIComponent(roomId)}/rpc`;
}

export function agentMessagesUrl(roomId: string, origin = apiOrigin()): string {
  const prefix = origin.replace(/\/$/, "");
  return `${prefix}/agents/room-actor/${encodeURIComponent(roomId)}/get-messages`;
}

export function agentWebSocketUrl(
  roomId: string,
  origin = apiOrigin(),
): string {
  const { host, secure } = agentSocketHost(origin);
  const scheme = secure ? "wss" : "ws";
  return `${scheme}://${host}/agents/room-actor/${encodeURIComponent(roomId)}`;
}

/** Office SPA thread. Live docs / slides / sheets still open here. */
export function officeThreadUrl(botId: string): string {
  return `${webOrigin()}/${encodeURIComponent(botId)}`;
}

export function officeAppUrl(botId: string, appId: string): string {
  const office = officeThreadUrl(botId);
  return `${office}?pane=app&app=${encodeURIComponent(appId)}`;
}
