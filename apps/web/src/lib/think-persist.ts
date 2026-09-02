import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { del, get, set } from "idb-keyval";
import { hydrateBotPreviews } from "./bot-preview";
import { orpc, queryClient } from "./orpc";
import { THINK_MESSAGES_GC_TIME, THINK_MESSAGES_ROOT } from "./think-messages";

export const THINK_CACHE_KEY = "groxbot-query-cache";
export const THINK_CACHE_BUSTER = "3";

const CATALOG_KEYS = new Set([
  JSON.stringify(orpc.bots.list.queryOptions().queryKey),
  JSON.stringify(orpc.apps.list.queryOptions().queryKey),
  JSON.stringify(orpc.plugins.list.queryOptions().queryKey),
  JSON.stringify(orpc.mcp.list.queryOptions().queryKey),
  JSON.stringify(orpc.knowledge.list.queryOptions().queryKey),
]);

const COMPUTER_LIST_KEY_PREFIX = queryKeyWithoutBot(
  orpc.computer.list.queryOptions({ input: { botId: "_" } }).queryKey,
);

export function isComputerListQueryKey(queryKey: readonly unknown[]): boolean {
  return queryKeyWithoutBot(queryKey) === COMPUTER_LIST_KEY_PREFIX;
}

export function shouldDehydrateThinkQuery(query: {
  queryKey: readonly unknown[];
  state: { status: string };
}): boolean {
  if (query.state.status !== "success") return false;
  if (query.queryKey[0] === THINK_MESSAGES_ROOT) return true;
  if (isComputerListQueryKey(query.queryKey)) return true;
  return CATALOG_KEYS.has(JSON.stringify(query.queryKey));
}

/** Drop bot-specific input so each teammate’s file tree shares the list procedure. */
function queryKeyWithoutBot(queryKey: readonly unknown[]): string {
  return JSON.stringify(queryKey, (_key, value) => {
    if (!value || typeof value !== "object" || !("botId" in value)) {
      return value;
    }
    const { botId: _botId, path: _path, ...rest } = value as {
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
      key: THINK_CACHE_KEY,
      throttleTime: 1000,
    })
  : null;

const persistOptions = persister
  ? {
      queryClient,
      persister,
      maxAge: THINK_MESSAGES_GC_TIME,
      buster: THINK_CACHE_BUSTER,
      dehydrateOptions: { shouldDehydrateQuery: shouldDehydrateThinkQuery },
    }
  : null;

export async function clearPersistedThinkCache(): Promise<void> {
  if (!persister) return;
  await persister.removeClient();
}

export function thinkCacheEnabled(): boolean {
  return persister !== null;
}

if (persistOptions) {
  const [, restored] = persistQueryClient(persistOptions);
  await restored.catch((error: unknown) => {
    console.warn("query persist unavailable", error);
  });
  hydrateBotPreviews();
}
