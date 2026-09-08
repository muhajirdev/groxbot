import type { Bot } from "@groxbot/contracts";
import { AVATAR_COLORS } from "./jobs";

export const NEW_BOT_NAME = "New Bot";

export function nextHireName(bots: { name: string }[]): string {
  const taken = new Set(bots.map((bot) => bot.name));
  if (!taken.has(NEW_BOT_NAME)) return NEW_BOT_NAME;
  for (let n = 2; n < 1000; n++) {
    const name = `${NEW_BOT_NAME} ${n}`;
    if (!taken.has(name)) return name;
  }
  return NEW_BOT_NAME;
}

let hireLock = false;

/** Process-wide so a Chat remount cannot start a second `bots.create`. */
export function beginHire(): boolean {
  if (hireLock) return false;
  hireLock = true;
  return true;
}

export function endHire(): void {
  hireLock = false;
}

export function isHireInFlight(): boolean {
  return hireLock;
}

/**
 * Create may time out after Postgres already committed. Treat a matching
 * `bots.get` as success so the client does not hire again.
 */
export async function settleCreatedHire(input: {
  botId: string;
  create: () => Promise<Bot>;
  get: (botId: string) => Promise<Bot>;
}): Promise<Bot> {
  try {
    return await input.create();
  } catch (caught) {
    try {
      return await input.get(input.botId);
    } catch {
      throw caught;
    }
  }
}

export function nextAvatarColor(bots: { avatarColor: string }[]): string {
  const used = new Set(bots.map((bot) => bot.avatarColor));
  return (
    AVATAR_COLORS.find((color) => !used.has(color)) ??
    AVATAR_COLORS[bots.length % AVATAR_COLORS.length] ??
    AVATAR_COLORS[0]
  );
}

/** Local roster row so Create new agent can paint before `bots.create` returns. */
export function draftCreatedBot(input: {
  id: string;
  workspaceId: string;
  name: string;
  avatarColor: string;
  avatarShape?: Bot["avatarShape"];
  homeRoomId?: string;
  userId?: string;
  visibility?: "private" | "shared";
  title?: string;
}): Bot {
  const now = new Date().toISOString();
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    userId: input.userId ?? "user",
    visibility: input.visibility ?? "shared",
    name: input.name,
    title: input.title ?? "",
    description: "",
    instructions: "",
    avatarColor: input.avatarColor,
    avatarShape: input.avatarShape ?? "circle",
    parentBotId: null,
    threadId: input.id,
    homeRoomId: input.homeRoomId ?? input.id,
    guestKind: "off",
    guestOnline: false,
    model: "",
    lastPreview: "",
    lastAt: now,
    archivedAt: null,
    pinnedAt: null,
    sectionId: null,
    createdAt: now,
    updatedAt: now,
  };
}
