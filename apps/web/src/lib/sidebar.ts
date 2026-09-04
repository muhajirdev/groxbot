import type { Bot } from "@groxbot/contracts";
import {
  compareSidebarBots,
  groupSidebarBots,
  isPinnedBot,
  mixSidebarLive,
  roomSidebarFaces,
} from "@groxbot/core/browser";

export {
  compareSidebarBots,
  groupSidebarBots,
  isPinnedBot,
  mixSidebarLive,
  roomSidebarFaces,
};

export type BotMenuPhase = "actions" | "confirm-delete" | "move";

export type BotMenuItem =
  | { id: "pin"; label: "Pin" | "Unpin" }
  | { id: "archive"; label: "Archive" | "Unarchive" }
  | { id: "move"; label: "Move to…" }
  | { id: "move-to"; sectionId: string | null; label: string }
  | { id: "share"; label: "Share with office" | "Make private" }
  | { id: "delete"; label: string; danger: true }
  | { id: "cancel-delete"; label: "Cancel" };

export function botMenuItems(input: {
  pinned: boolean;
  archived?: boolean;
  name: string;
  phase: BotMenuPhase;
  sections?: { id: string; name: string }[];
  owner?: boolean;
  visibility?: "private" | "shared";
}): BotMenuItem[] {
  if (input.phase === "confirm-delete") {
    return [
      { id: "delete", label: `Delete ${input.name}`, danger: true },
      { id: "cancel-delete", label: "Cancel" },
    ];
  }
  if (input.phase === "move") {
    return [
      { id: "move-to", sectionId: null, label: "Ungrouped" },
      ...(input.sections ?? []).map((section) => ({
        id: "move-to" as const,
        sectionId: section.id,
        label: section.name,
      })),
    ];
  }
  const items: BotMenuItem[] = [
    { id: "pin", label: input.pinned ? "Unpin" : "Pin" },
    { id: "archive", label: input.archived ? "Unarchive" : "Archive" },
  ];
  if (input.owner) {
    items.push({
      id: "share",
      label:
        input.visibility === "shared" ? "Make private" : "Share with office",
    });
  }
  if ((input.sections ?? []).length > 0) {
    items.push({ id: "move", label: "Move to…" });
  }
  items.push({ id: "delete", label: "Delete", danger: true });
  return items;
}

export function botMenuBox(
  phase: BotMenuPhase,
  itemCount?: number,
): {
  width: number;
  height: number;
} {
  if (phase === "confirm-delete") return { width: 196, height: 80 };
  if (phase === "move") {
    const n = Math.max(itemCount ?? 1, 1);
    return { width: 196, height: 8 + n * 36 };
  }
  const extra = Math.max(0, (itemCount ?? 3) - 3) * 36;
  return { width: 168, height: 120 + extra };
}

export type SectionMenuPhase = "actions" | "confirm-delete";

export type SectionMenuItem =
  | { id: "rename"; label: "Rename" }
  | { id: "delete"; label: string; danger: true }
  | { id: "cancel-delete"; label: "Cancel" };

export function sectionMenuItems(input: {
  name: string;
  phase: SectionMenuPhase;
}): SectionMenuItem[] {
  if (input.phase === "confirm-delete") {
    return [
      { id: "delete", label: `Delete ${input.name}`, danger: true },
      { id: "cancel-delete", label: "Cancel" },
    ];
  }
  return [
    { id: "rename", label: "Rename" },
    { id: "delete", label: "Delete", danger: true },
  ];
}

export function sectionMenuBox(phase: SectionMenuPhase): {
  width: number;
  height: number;
} {
  return phase === "confirm-delete"
    ? { width: 196, height: 80 }
    : { width: 168, height: 84 };
}

export type RoomMenuPhase = "actions" | "confirm-delete";

export type RoomMenuItem =
  | { id: "delete"; label: string; danger: true }
  | { id: "cancel-delete"; label: "Cancel" };

export function roomMenuItems(input: {
  name: string;
  phase: RoomMenuPhase;
}): RoomMenuItem[] {
  if (input.phase === "confirm-delete") {
    return [
      { id: "delete", label: `Delete ${input.name}`, danger: true },
      { id: "cancel-delete", label: "Cancel" },
    ];
  }
  return [{ id: "delete", label: "Delete", danger: true }];
}

export function roomMenuBox(phase: RoomMenuPhase): {
  width: number;
  height: number;
} {
  return phase === "confirm-delete"
    ? { width: 196, height: 80 }
    : { width: 168, height: 48 };
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
