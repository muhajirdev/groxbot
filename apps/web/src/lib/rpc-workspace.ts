import { WORKSPACE_ID_HEADER } from "@groxbot/contracts";

let currentWorkspaceId: string | null = null;
let workspaceEpoch = 0;
let liveCatalogWorkspaceId: string | null = null;

/** Stamp product RPC with the office in the URL. Session last-used is not the tenant. */
export function setRpcWorkspaceId(workspaceId: string | null): void {
  const id = workspaceId?.trim() || null;
  if (id !== currentWorkspaceId) workspaceEpoch += 1;
  currentWorkspaceId = id;
}

export function rpcWorkspaceId(): string | null {
  return currentWorkspaceId;
}

/** Bumps when the stamped office changes. In-flight catalog fetches must not land on a new tenant. */
export function rpcWorkspaceEpoch(): number {
  return workspaceEpoch;
}

export function rpcWorkspaceHeaders(): Record<string, string> {
  return currentWorkspaceId
    ? { [WORKSPACE_ID_HEADER]: currentWorkspaceId }
    : {};
}

/** Which office the live `bots.list` / `rooms.list` slice currently represents. */
export function liveCatalogId(): string | null {
  return liveCatalogWorkspaceId;
}

export function setLiveCatalogId(workspaceId: string | null): void {
  liveCatalogWorkspaceId = workspaceId?.trim() || null;
}

export function resetRpcWorkspace(): void {
  if (currentWorkspaceId !== null) workspaceEpoch += 1;
  currentWorkspaceId = null;
  liveCatalogWorkspaceId = null;
}
