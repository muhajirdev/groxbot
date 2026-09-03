import { WORKSPACE_ID_HEADER } from "@groxbot/contracts";

let currentWorkspaceId: string | null = null;

/** Stamp product RPC with the office in the URL. Session last-used is not the tenant. */
export function setRpcWorkspaceId(workspaceId: string | null): void {
  const id = workspaceId?.trim() || null;
  currentWorkspaceId = id;
}

export function rpcWorkspaceHeaders(): Record<string, string> {
  return currentWorkspaceId
    ? { [WORKSPACE_ID_HEADER]: currentWorkspaceId }
    : {};
}
