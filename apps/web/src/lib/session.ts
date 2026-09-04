import type { Bot, Room } from "@groxbot/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import {
  botsCollection,
  clearThreadStore,
  peekBots,
  peekRooms,
  roomsCollection,
  upsertBot,
} from "./collections";
import { OFFICE_TO, officeParams } from "./office-route";
import { orpc, queryClient } from "./orpc";
import { sessionQueryKey, sessionQueryOptions } from "./session-query";
import { destinationAfterWorkspaceChange } from "./workspace-switcher";

export { sessionQueryKey };

/** Footer chip: a real name, never the login email. */
export function officeProfileLabel(me?: {
  name?: string | null;
  email?: string | null;
} | null): string {
  const name = me?.name?.trim() || "";
  const email = me?.email?.trim() || "";
  if (!name || name === email || name.includes("@")) return "You";
  return name;
}

export function readSession(client: QueryClient) {
  return client.getQueryData(sessionQueryKey);
}

export async function loadSession(client: QueryClient) {
  return client.ensureQueryData(sessionQueryOptions);
}

/** Group rooms plus each person's home (and legacy `/bot/$botId` ids). */
export function catalogHasRoom(
  roomId: string,
  rooms: { id: string }[],
  bots: { id: string; homeRoomId?: string }[],
): boolean {
  return (
    rooms.some((room) => room.id === roomId) ||
    bots.some((bot) => bot.homeRoomId === roomId || bot.id === roomId)
  );
}

/**
 * Home rooms are not in `rooms.list`. Preload both catalogs, and only refetch
 * when the id is in neither — otherwise every office reload waits on the net.
 */
export async function loadOfficeRoomCatalog(roomId: string): Promise<{
  rooms: Room[];
  bots: Bot[];
}> {
  let rooms = peekRooms();
  let bots = peekBots();
  if (catalogHasRoom(roomId, rooms, bots)) {
    return { rooms, bots };
  }

  await Promise.all([roomsCollection.preload(), botsCollection.preload()]);
  rooms = peekRooms();
  bots = peekBots();
  if (catalogHasRoom(roomId, rooms, bots)) {
    return { rooms, bots };
  }

  await Promise.all([
    roomsCollection.utils.refetch(),
    botsCollection.utils.refetch(),
  ]);
  return { rooms: peekRooms(), bots: peekBots() };
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
  let bots = peekBots();
  const haveRequired =
    requiredBotId === undefined
      ? bots.length > 0 || botsCollection.isReady()
      : bots.some((bot) => bot.id === requiredBotId);
  if (!haveRequired) {
    await botsCollection.preload();
    bots = peekBots();
  }
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
    params: officeParams(me.workspaceSlug, first.homeRoomId || first.id),
  });
}

/** Drop the current office cache and open the active workspace. */
export async function enterActiveWorkspace(opts: {
  queryClient: QueryClient;
  invalidateRouter: () => Promise<unknown>;
  goOnboarding: () => Promise<unknown>;
  goBot: (roomId: string) => Promise<unknown>;
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
  await opts.goBot(dest.roomId);
}
