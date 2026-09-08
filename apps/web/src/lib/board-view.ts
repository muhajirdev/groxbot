import {
  parseBoardView,
  type BoardView,
} from "@groxbot/core/browser";

export const BOARD_VIEW_KEY = "groxbot.board-view";

export function readBoardView(): BoardView {
  try {
    return parseBoardView(localStorage.getItem(BOARD_VIEW_KEY));
  } catch {
    return "board";
  }
}

export function writeBoardView(view: BoardView): void {
  try {
    localStorage.setItem(BOARD_VIEW_KEY, view);
  } catch {
    // Private mode.
  }
}
