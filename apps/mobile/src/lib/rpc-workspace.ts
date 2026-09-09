import { WORKSPACE_ID_HEADER } from "@groxbot/contracts";

let currentWorkspaceId: string | null = null;

/** Stamp product RPC with the active office. Session last-used is not the tenant. */
export function setRpcWorkspaceId(workspaceId: string | null): void {
  currentWorkspaceId = workspaceId?.trim() || null;
}

export function rpcWorkspaceId(): string | null {
  return currentWorkspaceId;
}

export function rpcWorkspaceHeaders(): Record<string, string> {
  return currentWorkspaceId
    ? { [WORKSPACE_ID_HEADER]: currentWorkspaceId }
    : {};
}

export function resetRpcWorkspace(): void {
  currentWorkspaceId = null;
}
