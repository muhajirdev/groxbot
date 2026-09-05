import type {
  Bot,
  McpConnection,
  PluginConnection,
  Room,
  SidebarSection,
  WorkspaceApp,
} from "@groxbot/contracts";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import {
  createCollection,
  localOnlyCollectionOptions,
} from "@tanstack/react-db";
import { overlayBotList } from "./bot-preview";
import { orpc, queryClient } from "./orpc";
import { clearRoomMessages, overlayRoomList } from "./room-messages";
import { client } from "./rpc";
import { clearOfficeMessages, OFFICE_MESSAGES_GC_TIME } from "./office-messages";
import { clearPersistedOfficeCache } from "./office-persist";
import { resetRpcWorkspace } from "./rpc-workspace";
import { tenantBoundQueryFn } from "./tenant-query";
import { clearCachedWorkspace } from "./workspace-switcher";

export type ThreadMeta = {
  botId: string;
  cursor: number;
  working: string;
  error: string;
  /** Catalog insert still in flight — delay the office socket. */
  opening: boolean;
};

export const threadMetaCollection = createCollection(
  localOnlyCollectionOptions({
    id: "thread-meta",
    getKey: (item: ThreadMeta) => item.botId,
  }),
);

export const botsCollection = createCollection(
  queryCollectionOptions<Bot>({
    id: "bots",
    queryClient,
    queryKey: orpc.bots.list.queryOptions().queryKey,
    queryFn: tenantBoundQueryFn(orpc.bots.list.queryOptions().queryKey, async () =>
      overlayBotList(await client.bots.list()),
    ),
    getKey: (bot) => bot.id,
    staleTime: 30_000,
    gcTime: OFFICE_MESSAGES_GC_TIME,
    retry: false,
    refetchOnWindowFocus: false,
  }),
);

export function peekBots(): Bot[] {
  return [...botsCollection.values()];
}

export const roomsCollection = createCollection(
  queryCollectionOptions<Room>({
    id: "rooms",
    queryClient,
    queryKey: orpc.rooms.list.queryOptions().queryKey,
    queryFn: tenantBoundQueryFn(orpc.rooms.list.queryOptions().queryKey, async () =>
      overlayRoomList(await client.rooms.list()),
    ),
    getKey: (room) => room.id,
    staleTime: 30_000,
    gcTime: OFFICE_MESSAGES_GC_TIME,
    retry: false,
    refetchOnWindowFocus: false,
  }),
);

export function peekRooms(): Room[] {
  return [...roomsCollection.values()];
}

export const sectionsCollection = createCollection(
  queryCollectionOptions<SidebarSection>({
    id: "sidebar-sections",
    queryClient,
    queryKey: orpc.sections.list.queryOptions().queryKey,
    queryFn: tenantBoundQueryFn(orpc.sections.list.queryOptions().queryKey, () =>
      client.sections.list(),
    ),
    getKey: (section) => section.id,
    staleTime: 30_000,
    gcTime: OFFICE_MESSAGES_GC_TIME,
    retry: false,
    refetchOnWindowFocus: false,
  }),
);

export function peekSections(): SidebarSection[] {
  return [...sectionsCollection.values()];
}

export const appsCollection = createCollection(
  queryCollectionOptions<WorkspaceApp>({
    id: "workspace-apps",
    queryClient,
    queryKey: orpc.apps.list.queryOptions().queryKey,
    queryFn: tenantBoundQueryFn(orpc.apps.list.queryOptions().queryKey, () =>
      client.apps.list(),
    ),
    getKey: (app) => app.id,
    staleTime: 15_000,
    gcTime: OFFICE_MESSAGES_GC_TIME,
    retry: false,
    refetchOnWindowFocus: false,
  }),
);

export const mcpCollection = createCollection(
  queryCollectionOptions<McpConnection>({
    id: "mcp",
    queryClient,
    queryKey: orpc.mcp.list.queryOptions().queryKey,
    queryFn: tenantBoundQueryFn(orpc.mcp.list.queryOptions().queryKey, () =>
      client.mcp.list(),
    ),
    getKey: (item) => item.id,
    staleTime: 15_000,
    gcTime: OFFICE_MESSAGES_GC_TIME,
    retry: false,
    refetchOnWindowFocus: true,
  }),
);

export const pluginsCollection = createCollection(
  queryCollectionOptions<PluginConnection>({
    id: "plugins",
    queryClient,
    queryKey: orpc.plugins.list.queryOptions().queryKey,
    queryFn: tenantBoundQueryFn(orpc.plugins.list.queryOptions().queryKey, () =>
      client.plugins.list(),
    ),
    getKey: (item) => item.id,
    staleTime: 15_000,
    gcTime: OFFICE_MESSAGES_GC_TIME,
    retry: false,
    refetchOnWindowFocus: true,
  }),
);

export function upsertBot(bot: Bot): void {
  botsCollection.utils.writeUpsert(bot);
}

export function upsertRoom(room: Room): void {
  roomsCollection.utils.writeUpsert(room);
}

function dropSyncedKeys<TKey extends string | number>(collection: {
  keys(): IterableIterator<TKey>;
  utils: { writeDelete: (keys: TKey | TKey[]) => void };
}): void {
  const keys = [...collection.keys()];
  if (keys.length === 0) return;
  try {
    collection.utils.writeDelete(keys);
  } catch {
    // Query sync never started; there is nothing durable to drop.
  }
}

export function replaceSyncedRows<T extends { id: string }>(
  collection: {
    keys(): IterableIterator<string | number>;
    utils: {
      writeUpsert: (item: T) => void;
      writeDelete: (keys: string | number | Array<string | number>) => void;
    };
  },
  rows: readonly T[],
): void {
  try {
    for (const row of rows) collection.utils.writeUpsert(row);
    const keep = new Set(rows.map((row) => row.id));
    const stale = [...collection.keys()].filter((id) => !keep.has(String(id)));
    if (stale.length > 0) collection.utils.writeDelete(stale);
  } catch {
    // Query sync never started; QueryClient still holds the swapped slice.
  }
}

export function removeBot(id: string): void {
  if (!botsCollection.has(id)) return;
  try {
    botsCollection.utils.writeDelete([id]);
  } catch {
    // Query sync never started; there is nothing durable to drop.
  }
}

export function removeRoom(id: string): void {
  if (!roomsCollection.has(id)) return;
  try {
    roomsCollection.utils.writeDelete([id]);
  } catch {
    // Query sync never started; there is nothing durable to drop.
  }
}

export function patchBot(id: string, patch: Partial<Omit<Bot, "id">>): void {
  if (!botsCollection.has(id)) return;
  try {
    botsCollection.utils.writeUpdate({ id, ...patch });
  } catch {
    // Row is not in the synced store yet (preload in flight).
  }
}

export function upsertSection(section: SidebarSection): void {
  sectionsCollection.utils.writeUpsert(section);
}

export function patchSection(
  id: string,
  patch: Partial<Omit<SidebarSection, "id">>,
): void {
  if (!sectionsCollection.has(id)) return;
  try {
    sectionsCollection.utils.writeUpdate({ id, ...patch });
  } catch {
    // Row is not in the synced store yet (preload in flight).
  }
}

export function removeSection(id: string): void {
  if (!sectionsCollection.has(id)) return;
  try {
    sectionsCollection.utils.writeDelete([id]);
  } catch {
    // Query sync never started; there is nothing durable to drop.
  }
}

export function clearThreadStore(): void {
  clearOfficeMessages();
  clearRoomMessages();
  clearCachedWorkspace();
  resetRpcWorkspace();
  void clearPersistedOfficeCache();
  const metaKeys = [...threadMetaCollection.keys()];
  if (metaKeys.length > 0) threadMetaCollection.delete(metaKeys);
  dropSyncedKeys(botsCollection);
  dropSyncedKeys(roomsCollection);
  dropSyncedKeys(sectionsCollection);
  dropSyncedKeys(appsCollection);
  dropSyncedKeys(pluginsCollection);
  dropSyncedKeys(mcpCollection);
}
