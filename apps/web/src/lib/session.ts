import type { Bot } from "@groxbot/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { authClient } from "./auth";
import {
  botsCollection,
  clearThreadStore,
  peekBots,
  upsertBot,
} from "./collections";
import { OFFICE_TO, officeParams } from "./office-route";
import { orpc, queryClient } from "./orpc";
import { destinationAfterWorkspaceChange } from "./workspace-switcher";

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
  if (!me.workspaceSlug) throw redirect({ to: "/onboarding", search: {} });
  throw redirect({
    to: OFFICE_TO,
    params: officeParams(me.workspaceSlug, first.id),
  });
}

/** Drop the current office cache and open the active workspace. */
export async function enterActiveWorkspace(opts: {
  queryClient: QueryClient;
  invalidateRouter: () => Promise<unknown>;
  goOnboarding: () => Promise<unknown>;
  goBot: (botId: string) => Promise<unknown>;
}): Promise<void> {
  clearThreadStore();
  await opts.queryClient.invalidateQueries();
  if (botsCollection.isReady()) {
    await botsCollection.utils.refetch();
  } else {
    await botsCollection.preload();
  }
  const dest = destinationAfterWorkspaceChange(peekBots());
  await opts.invalidateRouter();
  if (dest.to === "/onboarding") {
    await opts.goOnboarding();
    return;
  }
  await opts.goBot(dest.botId);
}
