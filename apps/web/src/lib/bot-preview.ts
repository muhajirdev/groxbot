import type { Bot } from "@groxbot/contracts";
import { officePreviewsFromCache } from "./office-messages";
import { orpc, queryClient } from "./orpc";

/**
 * Office chat lives in IndexedDB, not Postgres.
 * Keep a sidebar preview across `bots.list` refetches that send "".
 */
export function mergeBotList(
  server: readonly Bot[],
  cached: readonly Bot[] | undefined,
  officePreviews: ReadonlyMap<string, string>,
): Bot[] {
  const cachedById = new Map((cached ?? []).map((bot) => [bot.id, bot]));
  let changed = false;
  const next = server.map((bot) => {
    const lastPreview =
      officePreviews.get(bot.homeRoomId) ||
      officePreviews.get(bot.id) ||
      bot.lastPreview ||
      cachedById.get(bot.id)?.lastPreview ||
      "";
    if (lastPreview === bot.lastPreview) return bot;
    changed = true;
    return { ...bot, lastPreview };
  });
  return changed ? next : (server as Bot[]);
}

export function overlayBotList(server: Bot[]): Bot[] {
  return mergeBotList(
    server,
    queryClient.getQueryData<Bot[]>(orpc.bots.list.queryOptions().queryKey),
    officePreviewsFromCache(),
  );
}

/** After IndexedDB restore, copy cached thread lines onto the roster. */
export function hydrateBotPreviews(): void {
  const key = orpc.bots.list.queryOptions().queryKey;
  const current = queryClient.getQueryData<Bot[]>(key);
  if (!current) return;
  const next = mergeBotList(current, current, officePreviewsFromCache());
  if (next === current) return;
  queryClient.setQueryData(key, next);
}
