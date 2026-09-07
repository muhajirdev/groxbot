import { WORKSPACE_ID_HEADER } from "@groxbot/contracts";
import { apiOrigin } from "./host";
import { rpcWorkspaceId } from "./rpc-workspace";

/** WebSocket to this conversation’s RoomActor (person or group). */
export function officeRpcUrl(roomId: string): string {
  const http = apiOrigin().replace(/\/$/, "");
  const ws = http.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  const path = `${ws}/rooms/${encodeURIComponent(roomId)}/rpc`;
  const workspaceId = rpcWorkspaceId();
  return workspaceId
    ? `${path}?${WORKSPACE_ID_HEADER}=${encodeURIComponent(workspaceId)}`
    : path;
}
