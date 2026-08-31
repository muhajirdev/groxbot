import type { Bot } from "@groxbot/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { authClient } from "./auth";
import { botsCollection, peekBots, upsertBot } from "./collections";
import { orpc, queryClient } from "./orpc";

export const sessionQueryKey = ["auth", "session"] as const;

export function readSession(client: QueryClient) {
  return client.getQueryData(sessionQueryKey);
}

export async function loadSession(client: QueryClient) {
  return client.ensureQueryData({
    queryKey: sessionQueryKey,
    queryFn: async () => {
      const { data } = await authClient.getSession();
      return data ?? null;
    },
    staleTime: 5 * 60_000,
  });
}

export function isArchivedBot(bot: Bot): boolean {
  return Boolean(bot.archivedAt);
}

/** Prefer a live teammate; fall back to an archived one if that's all that's left. */
export function firstLiveBot(bots: Bot[]): Bot | undefined {
  return bots.find((bot) => !isArchivedBot(bot)) ?? bots[0];
}

export function cacheBot(bot: Bot) {
  upsertBot(bot);
}

/** Keep a just-created bot in the roster so loaders don't wait on a list refetch. */
export async function cacheCreatedBot(bot: Bot) {
  if (!botsCollection.isReady()) await botsCollection.preload();
  upsertBot(bot);
}

export async function loadBotsForRoute(requiredBotId?: string): Promise<Bot[]> {
  await botsCollection.preload();
  let bots = peekBots();
  const missingRequired =
    requiredBotId !== undefined &&
    !bots.some((bot) => bot.id === requiredBotId);
  if (missingRequired) {
    await botsCollection.utils.refetch();
    bots = peekBots();
  }
  return bots;
}

/** Send the user to hire, join, or the office. */
export async function redirectAuthedHome(): Promise<never> {
  const me = await queryClient.ensureQueryData(orpc.me.queryOptions());
  if (me.needsWorkspace) throw redirect({ to: "/onboarding", search: {} });
  const bots = await loadBotsForRoute();
  const first = firstLiveBot(bots);
  if (!first) throw redirect({ to: "/onboarding", search: {} });
  throw redirect({ to: "/$botId", params: { botId: first.id } });
}
