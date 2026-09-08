import { describe, expect, it, vi } from "vitest";
import { BOARD_VIEW_KEY, readBoardView, writeBoardView } from "./board-view";

describe("readBoardView", () => {
  it("remembers list and defaults to the kanban board", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });
    expect(readBoardView()).toBe("board");
    writeBoardView("list");
    expect(store.get(BOARD_VIEW_KEY)).toBe("list");
    expect(readBoardView()).toBe("list");
    writeBoardView("board");
    expect(readBoardView()).toBe("board");
    vi.unstubAllGlobals();
  });
});
