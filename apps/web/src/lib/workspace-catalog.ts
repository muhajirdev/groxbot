import type {
  Bot,
  KnowledgeList,
  McpConnection,
  Me,
  PluginConnection,
  Room,
  SidebarSection,
  WorkspaceApp,
} from "@groxbot/contracts";
import {
  appsCollection,
  botsCollection,
  mcpCollection,
  peekBots,
  peekRooms,
  peekSections,
  pluginsCollection,
  replaceSyncedRows,
  roomsCollection,
  sectionsCollection,
} from "./collections";
import { OFFICE_MESSAGES_GC_TIME } from "./office-messages";
import { orpc, queryClient } from "./orpc";
import { client } from "./rpc";
import {
  liveCatalogId,
  rpcWorkspaceEpoch,
  rpcWorkspaceId,
  setLiveCatalogId,
  setRpcWorkspaceId,
} from "./rpc-workspace";
import { tenantBoundQueryFn } from "./tenant-query";
import {
  readCachedWorkspace,
  readLastRoom,
  destinationAfterWorkspaceChange,
  writeCachedWorkspace,
  type WorkspaceDestination,
} from "./workspace-switcher";

export const WORKSPACE_CATALOG_ROOT = "workspace-catalog";

export type WorkspaceCatalogSnapshot = {
  bots: Bot[];
  rooms: Room[];
  sections: SidebarSection[];
  apps: WorkspaceApp[];
  plugins: PluginConnection[];
  mcp: McpConnection[];
  knowledge: KnowledgeList | null;
};

export function workspaceCatalogKey(workspaceId: string) {
  return [WORKSPACE_CATALOG_ROOT, workspaceId] as const;
}

export function isWorkspaceCatalogQueryKey(
  queryKey: readonly unknown[],
): boolean {
  return (
    queryKey[0] === WORKSPACE_CATALOG_ROOT && typeof queryKey[1] === "string"
  );
}

export const botsListKey = orpc.bots.list.queryOptions().queryKey;
export const roomsListKey = orpc.rooms.list.queryOptions().queryKey;
export const sectionsListKey = orpc.sections.list.queryOptions().queryKey;
export const appsListKey = orpc.apps.list.queryOptions().queryKey;
export const pluginsListKey = orpc.plugins.list.queryOptions().queryKey;
export const mcpListKey = orpc.mcp.list.queryOptions().queryKey;
export const knowledgeListKey = orpc.knowledge.list.queryOptions().queryKey;

const EMPTY_KNOWLEDGE: KnowledgeList = { entries: [], truncated: false };

export function knowledgeListQueryOptions() {
  return {
    ...orpc.knowledge.list.queryOptions(),
    gcTime: OFFICE_MESSAGES_GC_TIME,
    queryFn: tenantBoundQueryFn(knowledgeListKey, () => client.knowledge.list()),
  };
}

export function listedBots(): Bot[] {
  const live = peekBots();
  if (live.length > 0) return live;
  return queryClient.getQueryData<Bot[]>(botsListKey) ?? [];
}

export function listedRooms(): Room[] {
  const live = peekRooms();
  if (live.length > 0) return live;
  return queryClient.getQueryData<Room[]>(roomsListKey) ?? [];
}

function listedSections(): SidebarSection[] {
  const live = peekSections();
  if (live.length > 0) return live;
  return queryClient.getQueryData<SidebarSection[]>(sectionsListKey) ?? [];
}

function listedQuery<T>(key: readonly unknown[]): T[] {
  return queryClient.getQueryData<T[]>(key) ?? [];
}

export function peekWorkspaceCatalog(
  workspaceId: string,
): WorkspaceCatalogSnapshot | undefined {
  return queryClient.getQueryData(workspaceCatalogKey(workspaceId));
}

function captureLiveCatalog(): WorkspaceCatalogSnapshot {
  return {
    bots: listedBots(),
    rooms: listedRooms(),
    sections: listedSections(),
    apps: listedQuery<WorkspaceApp>(appsListKey),
    plugins: listedQuery<PluginConnection>(pluginsListKey),
    mcp: listedQuery<McpConnection>(mcpListKey),
    knowledge:
      queryClient.getQueryData<KnowledgeList>(knowledgeListKey) ?? null,
  };
}

export function snapshotWorkspaceCatalog(workspaceId: string): void {
  const id = workspaceId.trim();
  if (!id) return;
  queryClient.setQueryData(workspaceCatalogKey(id), captureLiveCatalog());
}

function dropUnscopedKnowledgeBodies(): void {
  queryClient.removeQueries({ queryKey: orpc.knowledge.read.key() });
  queryClient.removeQueries({ queryKey: orpc.knowledge.graph.key() });
  queryClient.removeQueries({ queryKey: orpc.knowledge.search.key() });
  queryClient.removeQueries({ queryKey: orpc.knowledge.download.key() });
  queryClient.removeQueries({ queryKey: orpc.knowledge.shares.key() });
}

function applyLiveCatalog(snapshot: WorkspaceCatalogSnapshot): void {
  queryClient.setQueryData(botsListKey, snapshot.bots);
  queryClient.setQueryData(roomsListKey, snapshot.rooms);
  queryClient.setQueryData(sectionsListKey, snapshot.sections);
  queryClient.setQueryData(appsListKey, snapshot.apps);
  queryClient.setQueryData(pluginsListKey, snapshot.plugins);
  queryClient.setQueryData(mcpListKey, snapshot.mcp);
  queryClient.setQueryData(
    knowledgeListKey,
    snapshot.knowledge ?? EMPTY_KNOWLEDGE,
  );
  replaceSyncedRows(botsCollection, snapshot.bots);
  replaceSyncedRows(roomsCollection, snapshot.rooms);
  replaceSyncedRows(sectionsCollection, snapshot.sections);
  replaceSyncedRows(appsCollection, snapshot.apps);
  replaceSyncedRows(pluginsCollection, snapshot.plugins);
  replaceSyncedRows(mcpCollection, snapshot.mcp);
}

const EMPTY_CATALOG: WorkspaceCatalogSnapshot = {
  bots: [],
  rooms: [],
  sections: [],
  apps: [],
  plugins: [],
  mcp: [],
  knowledge: EMPTY_KNOWLEDGE,
};

/**
 * Point the live catalog slice at `workspaceId`. Snapshot the office we are
 * leaving so coming back is a cache hit, not a wipe-and-wait.
 */
export function adoptWorkspaceCatalog(workspaceId: string): void {
  const nextId = workspaceId.trim();
  if (!nextId) return;

  const tracked = liveCatalogId();
  if (tracked === nextId) {
    if (!peekWorkspaceCatalog(nextId)) snapshotWorkspaceCatalog(nextId);
    return;
  }

  const hinted = readCachedWorkspace()?.id ?? null;
  const previous =
    tracked ?? (hinted && hinted !== nextId ? hinted : null);

  if (!previous && hinted === nextId) {
    setLiveCatalogId(nextId);
    if (!peekWorkspaceCatalog(nextId)) snapshotWorkspaceCatalog(nextId);
    return;
  }

  if (previous) snapshotWorkspaceCatalog(previous);

  const snapshot = peekWorkspaceCatalog(nextId);
  if (previous) {
    dropUnscopedKnowledgeBodies();
    applyLiveCatalog(snapshot ?? EMPTY_CATALOG);
  } else if (snapshot) {
    applyLiveCatalog(snapshot);
  }
  setLiveCatalogId(nextId);
  if (!peekWorkspaceCatalog(nextId)) snapshotWorkspaceCatalog(nextId);
}

export function patchMeWorkspace(workspace: {
  id: string;
  name: string;
  slug: string;
}): void {
  queryClient.setQueryData(
    orpc.me.key(),
    (prev: Me | undefined): Me | undefined => {
      if (!prev) return prev;
      return {
        ...prev,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
        needsWorkspace: false,
      };
    },
  );
}

export function workspaceSwitchDestination(
  workspaceId: string,
): WorkspaceDestination {
  return destinationAfterWorkspaceChange(listedBots(), {
    lastRoomId: readLastRoom(workspaceId),
    rooms: listedRooms(),
  });
}

export function refetchWorkspaceCatalogs(): void {
  const epoch = rpcWorkspaceEpoch();
  const after = () => {
    if (rpcWorkspaceEpoch() !== epoch) return;
    const id = rpcWorkspaceId();
    if (id) snapshotWorkspaceCatalog(id);
  };
  const refetchCollection = (collection: {
    isReady: () => boolean;
    preload: () => Promise<unknown>;
    utils: { refetch: () => Promise<unknown> };
  }) => {
    const run = collection.isReady()
      ? collection.utils.refetch()
      : collection.preload();
    void run.then(after, () => undefined);
  };
  refetchCollection(botsCollection);
  refetchCollection(roomsCollection);
  refetchCollection(sectionsCollection);
  refetchCollection(appsCollection);
  refetchCollection(pluginsCollection);
  refetchCollection(mcpCollection);
  void queryClient
    .invalidateQueries({ queryKey: knowledgeListKey })
    .then(after, () => undefined);
  void queryClient.invalidateQueries({ queryKey: orpc.me.key() });
  void queryClient.invalidateQueries({ queryKey: orpc.models.get.key() });
  void queryClient.invalidateQueries({
    queryKey: orpc.workspaces.members.key(),
  });
}

/** Stamp RPC, swap the live slice, remember the name. Navigation is the caller's. */
export function prepareWorkspaceSwitch(workspace: {
  id: string;
  name: string;
  slug: string;
}): WorkspaceDestination {
  setRpcWorkspaceId(workspace.id);
  adoptWorkspaceCatalog(workspace.id);
  writeCachedWorkspace(workspace);
  patchMeWorkspace(workspace);
  refetchWorkspaceCatalogs();
  return workspaceSwitchDestination(workspace.id);
}
