import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { del, get, set } from "idb-keyval";
import { hydrateBotPreviews } from "./bot-preview";
import {
  OFFICE_MESSAGES_GC_TIME,
  OFFICE_MESSAGES_ROOT,
} from "./office-messages";
import { orpc, queryClient } from "./orpc";
import { PLUGIN_CATALOG_KEY } from "./plugins";
import { hydrateRoomPreviews, ROOM_MESSAGES_ROOT } from "./room-messages";
import { sessionQueryOptions } from "./session-query";

export const OFFICE_CACHE_KEY = "groxbot-query-cache";
export const OFFICE_CACHE_BUSTER = "6";

export function workspaceListQueryOptions() {
  return {
    ...orpc.workspaces.list.queryOptions(),
    gcTime: OFFICE_MESSAGES_GC_TIME,
  };
}

const CATALOG_KEYS = new Set([
  JSON.stringify(orpc.bots.list.queryOptions().queryKey),
  JSON.stringify(orpc.rooms.list.queryOptions().queryKey),
  JSON.stringify(orpc.workspaces.list.queryOptions().queryKey),
  JSON.stringify(orpc.apps.list.queryOptions().queryKey),
  JSON.stringify(orpc.plugins.list.queryOptions().queryKey),
  JSON.stringify(orpc.mcp.list.queryOptions().queryKey),
  JSON.stringify(orpc.knowledge.list.queryOptions().queryKey),
  JSON.stringify(PLUGIN_CATALOG_KEY),
]);

const COMPUTER_LIST_KEY_PREFIX = queryKeyWithoutBot(
  orpc.computer.list.queryOptions({ input: { botId: "_" } }).queryKey,
);

export function isComputerListQueryKey(queryKey: readonly unknown[]): boolean {
  return queryKeyWithoutBot(queryKey) === COMPUTER_LIST_KEY_PREFIX;
}

export function shouldDehydrateOfficeQuery(query: {
  queryKey: readonly unknown[];
  state: { status: string };
}): boolean {
  if (query.state.status !== "success") return false;
  if (query.queryKey[0] === OFFICE_MESSAGES_ROOT) return true;
  if (query.queryKey[0] === ROOM_MESSAGES_ROOT) return true;
  if (isComputerListQueryKey(query.queryKey)) return true;
  return CATALOG_KEYS.has(JSON.stringify(query.queryKey));
}

/** Drop bot-specific input so each teammate’s file tree shares the list procedure. */
function queryKeyWithoutBot(queryKey: readonly unknown[]): string {
  return JSON.stringify(queryKey, (_key, value) => {
    if (!value || typeof value !== "object" || !("botId" in value)) {
      return value;
    }
    const {
      botId: _botId,
      path: _path,
      ...rest
    } = value as {
      botId?: unknown;
      path?: unknown;
    } & Record<string, unknown>;
    return { ...rest, botId: "*" };
  });
}

function indexedDbAvailable(): boolean {
  return typeof indexedDB === "object" && indexedDB !== null;
}

const persister = indexedDbAvailable()
  ? createAsyncStoragePersister({
      storage: {
        getItem: async (key) => (await get(key)) ?? null,
        setItem: (key, value) => set(key, value),
        removeItem: (key) => del(key),
      },
      key: OFFICE_CACHE_KEY,
      throttleTime: 1000,
    })
  : null;

const persistOptions = persister
  ? {
      queryClient,
      persister,
      maxAge: OFFICE_MESSAGES_GC_TIME,
      buster: OFFICE_CACHE_BUSTER,
      dehydrateOptions: { shouldDehydrateQuery: shouldDehydrateOfficeQuery },
    }
  : null;

export async function clearPersistedOfficeCache(): Promise<void> {
  if (!persister) return;
  await persister.removeClient();
}

export function officeCacheEnabled(): boolean {
  return persister !== null;
}

/** Cookie session is not in IDB — start it while restore runs so boot is one wait. */
function warmSessionQueries(): void {
  if (typeof document === "undefined") return;
  void queryClient.ensureQueryData(sessionQueryOptions).then((session) => {
    if (!session) return;
    void queryClient.ensureQueryData(orpc.me.queryOptions());
  });
}

warmSessionQueries();

if (persistOptions) {
  const [, restored] = persistQueryClient(persistOptions);
  await restored.catch((error: unknown) => {
    console.warn("query persist unavailable", error);
  });
  hydrateBotPreviews();
  hydrateRoomPreviews();
}
