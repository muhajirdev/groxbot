/** Listed group-room status in D1. Product tasks live in knowledge markdown. */

import { RoomWorkStatus } from "@groxbot/contracts";

export const ROOM_WORK_STATUSES = RoomWorkStatus.options;
export type { RoomWorkStatus };

export const DEFAULT_ROOM_WORK_STATUS: RoomWorkStatus = "todo";

export const ROOM_WORK_STATUS_LABEL: Record<RoomWorkStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
  blocked: "Blocked",
};

/** How the task board lays knowledge tasks out. */
export const BOARD_VIEWS = ["board", "list"] as const;
export type BoardView = (typeof BOARD_VIEWS)[number];

export const BOARD_VIEW_LABEL: Record<BoardView, string> = {
  board: "Board",
  list: "List",
};

export function parseBoardView(value: unknown): BoardView {
  return value === "list" ? "list" : "board";
}

const STATUS_SET = new Set<string>(ROOM_WORK_STATUSES);

export function parseRoomWorkStatus(value: unknown): RoomWorkStatus {
  if (typeof value === "string" && STATUS_SET.has(value)) {
    return value as RoomWorkStatus;
  }
  return DEFAULT_ROOM_WORK_STATUS;
}

export function groupRoomsByWorkStatus<T extends { status?: string }>(
  rooms: readonly T[],
): Record<RoomWorkStatus, T[]> {
  const grouped = Object.fromEntries(
    ROOM_WORK_STATUSES.map((status) => [status, [] as T[]]),
  ) as Record<RoomWorkStatus, T[]>;
  for (const room of rooms) {
    grouped[parseRoomWorkStatus(room.status)].push(room);
  }
  return grouped;
}
