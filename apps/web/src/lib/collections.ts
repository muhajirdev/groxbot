import type {
  Bot,
  PluginConnection,
  ThreadMessage,
  WorkspaceApp,
} from "@groxbot/contracts";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import {
  createCollection,
  localOnlyCollectionOptions,
} from "@tanstack/react-db";
import { orpc, queryClient } from "./orpc";
import { client } from "./rpc";

export type CachedMessage = ThreadMessage & { botId: string };

export type ThreadMeta = {
  botId: string;
  cursor: number;
  working: string;
  error: string;
};

export const messagesCollection = createCollection(
  localOnlyCollectionOptions<CachedMessage>({
    id: "thread-messages",
    getKey: (item) => item.id,
  }),
);

export const threadMetaCollection = createCollection(
  localOnlyCollectionOptions<ThreadMeta>({
    id: "thread-meta",
    getKey: (item) => item.botId,
  }),
);

export const botsCollection = createCollection(
  queryCollectionOptions<Bot>({
    id: "bots",
    queryClient,
    queryKey: orpc.bots.list.queryOptions().queryKey,
    queryFn: () => client.bots.list(),
    getKey: (bot) => bot.id,
    staleTime: 30_000,
    gcTime: 30 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  }),
);

export function peekBots(): Bot[] {
  return [...botsCollection.values()];
}

export const appsCollection = createCollection(
  queryCollectionOptions<WorkspaceApp>({
    id: "workspace-apps",
    queryClient,
    queryKey: orpc.apps.list.queryOptions().queryKey,
    queryFn: () => client.apps.list(),
    getKey: (app) => app.id,
    staleTime: 15_000,
    gcTime: 30 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  }),
);

export const pluginsCollection = createCollection(
  queryCollectionOptions<PluginConnection>({
    id: "plugins",
    queryClient,
    queryKey: orpc.plugins.list.queryOptions().queryKey,
    queryFn: () => client.plugins.list(),
    getKey: (item) => item.id,
    staleTime: 15_000,
    gcTime: 30 * 60_000,
    retry: false,
    refetchOnWindowFocus: true,
  }),
);

export function upsertBot(bot: Bot): void {
  botsCollection.utils.writeUpsert(bot);
}

export function patchBot(id: string, patch: Partial<Omit<Bot, "id">>): void {
  if (!botsCollection.has(id)) return;
  try {
    botsCollection.utils.writeUpdate({ id, ...patch });
  } catch {
    // Row is not in the synced store yet (preload in flight).
  }
}

export function clearThreadStore(): void {
  const messageKeys = [...messagesCollection.keys()];
  if (messageKeys.length > 0) messagesCollection.delete(messageKeys);
  const metaKeys = [...threadMetaCollection.keys()];
  if (metaKeys.length > 0) threadMetaCollection.delete(metaKeys);
  const botKeys = [...botsCollection.keys()];
  if (botKeys.length === 0) return;
  try {
    botsCollection.utils.writeDelete(botKeys);
  } catch {
    // Query sync never started; there is nothing durable to drop.
  }
}
