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
  homeRoomId?: string;
}): Bot {
  const now = new Date().toISOString();
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    name: input.name,
    title: "",
    description: "",
    instructions: "",
    avatarColor: input.avatarColor,
    avatarShape: "circle",
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
    createdAt: now,
    updatedAt: now,
  };
}
