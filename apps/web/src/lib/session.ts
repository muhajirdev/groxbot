import type { Bot, Room } from "@groxbot/contracts";
import { hiredBotFromCodeResult } from "@groxbot/core/browser";
import type { QueryClient } from "@tanstack/react-query";
import {
  botsCollection,
  roomsCollection,
  upsertBot,
} from "./collections";
import { OFFICE_TO, WORKSPACE_TO, officeParams } from "./office-route";
import { client } from "./rpc";
import { sessionQueryKey, sessionQueryOptions } from "./session-query";
import {
  listedBots,
  listedRooms,
  prepareWorkspaceSwitch,
} from "./workspace-catalog";

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
  let rooms = listedRooms();
  let bots = listedBots();
  if (catalogHasRoom(roomId, rooms, bots)) {
    return { rooms, bots };
  }

  await Promise.all([roomsCollection.preload(), botsCollection.preload()]);
  rooms = listedRooms();
  bots = listedBots();
  if (catalogHasRoom(roomId, rooms, bots)) {
    return { rooms, bots };
  }

  await Promise.all([
    roomsCollection.utils.refetch(),
    botsCollection.utils.refetch(),
  ]);
  return { rooms: listedRooms(), bots: listedBots() };
}

export function isArchivedBot(bot: Bot): boolean {
  return Boolean(bot.archivedAt);
}

/** Prefer a live teammate; fall back to an archived one if that's all that's left. */
export function firstLiveBot(bots: Bot[]): Bot | undefined {
  return bots.find((bot) => !isArchivedBot(bot)) ?? bots[0];
}

/**
 * Unknown `/room/$roomId` → a live desk. Same id again would be a
 * TanStack redirect loop; missing roster → hire.
 */
export function unknownRoomRedirect(opts: {
  roomId: string;
  workspaceSlug: string;
  rooms: { id: string }[];
  bots: { id: string; homeRoomId?: string; archivedAt?: string | null }[];
}):
  | { to: typeof WORKSPACE_TO; params: { workspaceSlug: string } }
  | {
      to: typeof OFFICE_TO;
      params: { workspaceSlug: string; roomId: string };
    }
  | null {
  if (catalogHasRoom(opts.roomId, opts.rooms, opts.bots)) return null;
  const first =
    opts.bots.find((bot) => !bot.archivedAt) ?? opts.bots[0];
  if (!first) {
    return {
      to: WORKSPACE_TO,
      params: { workspaceSlug: opts.workspaceSlug },
    };
  }
  const fallback = first.homeRoomId || first.id;
  if (fallback === opts.roomId) return null;
  return {
    to: OFFICE_TO,
    params: officeParams(opts.workspaceSlug, fallback),
  };
}

export function cacheBot(bot: Bot) {
  upsertBot(bot);
}

/** Keep a just-created bot in the roster so loaders don't wait on a list refetch. */
export async function cacheCreatedBot(bot: Bot) {
  if (!botsCollection.isReady()) await botsCollection.preload();
  upsertBot(bot);
}

/** After Code Mode hire approval, paint the new teammate on the sidebar. */
export async function cacheHiredTeammate(result: unknown): Promise<boolean> {
  const hired = hiredBotFromCodeResult(result);
  if (!hired) return false;
  try {
    const bot = await client.bots.get({ botId: hired.id });
    await cacheCreatedBot(bot);
    return true;
  } catch {
    try {
      await botsCollection.utils.refetch();
      return true;
    } catch {
      return false;
    }
  }
}

export async function loadBotsForRoute(requiredBotId?: string): Promise<Bot[]> {
  let bots = listedBots();
  const haveRequired =
    requiredBotId === undefined
      ? bots.length > 0 || botsCollection.isReady()
      : bots.some((bot) => bot.id === requiredBotId);
  if (!haveRequired) {
    await botsCollection.preload();
    bots = listedBots();
  }
  const missingRequired =
    requiredBotId !== undefined &&
    !bots.some((bot) => bot.id === requiredBotId);
  if (missingRequired) {
    await botsCollection.utils.refetch();
    bots = listedBots();
  }
  return bots;
}

/** Swap the live office slice and open it. Do not wipe persist — the other office stays cached. */
export async function enterActiveWorkspace(opts: {
  workspace: { id: string; name: string; slug: string };
  goWorkspace: () => Promise<unknown>;
  goBot: (roomId: string) => Promise<unknown>;
  refetch?: boolean;
}): Promise<void> {
  const dest = prepareWorkspaceSwitch(opts.workspace, {
    refetch: opts.refetch,
  });
  if (dest.to === "workspace") {
    await opts.goWorkspace();
    return;
  }
  await opts.goBot(dest.roomId);
}
