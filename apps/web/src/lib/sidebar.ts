import type { Bot } from "@groxbot/contracts";

export function isPinnedBot(bot: Pick<Bot, "pinnedAt">): boolean {
  return Boolean(bot.pinnedAt);
}

export function compareSidebarBots(
  a: Pick<Bot, "pinnedAt" | "lastAt">,
  b: Pick<Bot, "pinnedAt" | "lastAt">,
): number {
  const aPinned = isPinnedBot(a);
  const bPinned = isPinnedBot(b);
  if (aPinned !== bPinned) return aPinned ? -1 : 1;
  return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
}

export type BotMenuPhase = "actions" | "confirm-delete";

export type BotMenuItem =
  | { id: "pin"; label: "Pin" | "Unpin" }
  | { id: "delete"; label: string; danger: true }
  | { id: "cancel-delete"; label: "Cancel" };

export function botMenuItems(input: {
  pinned: boolean;
  name: string;
  phase: BotMenuPhase;
}): BotMenuItem[] {
  if (input.phase === "confirm-delete") {
    return [
      { id: "delete", label: `Delete ${input.name}`, danger: true },
      { id: "cancel-delete", label: "Cancel" },
    ];
  }
  return [
    { id: "pin", label: input.pinned ? "Unpin" : "Pin" },
    { id: "delete", label: "Delete", danger: true },
  ];
}

export function botMenuBox(phase: BotMenuPhase): {
  width: number;
  height: number;
} {
  return phase === "confirm-delete"
    ? { width: 196, height: 80 }
    : { width: 168, height: 84 };
}

/** Stay on the open teammate unless that one was deleted. */
export function nextBotIdAfterDelete(
  remaining: readonly Pick<Bot, "id" | "archivedAt">[],
  deletedId: string,
  currentId: string,
): string | null {
  if (deletedId !== currentId) {
    return remaining.some((bot) => bot.id === currentId)
      ? currentId
      : firstRemainingBotId(remaining);
  }
  return firstRemainingBotId(remaining);
}

function firstRemainingBotId(
  remaining: readonly Pick<Bot, "id" | "archivedAt">[],
): string | null {
  return (
    remaining.find((bot) => !bot.archivedAt)?.id ?? remaining[0]?.id ?? null
  );
}
