import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM_WORK_STATUS,
  groupRoomsByWorkStatus,
  parseBoardView,
  parseRoomWorkStatus,
} from "./room-work.js";

describe("parseRoomWorkStatus", () => {
  it("keeps a known column", () => {
    expect(parseRoomWorkStatus("in_progress")).toBe("in_progress");
  });

  it("falls back so cached rooms without status still list", () => {
    expect(parseRoomWorkStatus(undefined)).toBe(DEFAULT_ROOM_WORK_STATUS);
    expect(parseRoomWorkStatus("nope")).toBe("todo");
  });
});

describe("groupRoomsByWorkStatus", () => {
  it("puts each room in one Multica-shaped column", () => {
    const grouped = groupRoomsByWorkStatus([
      { id: "a", status: "todo" },
      { id: "b", status: "in_progress" },
      { id: "c", status: "in_progress" },
      { id: "d" },
    ]);
    expect(grouped.todo.map((row) => row.id)).toEqual(["a", "d"]);
    expect(grouped.in_progress.map((row) => row.id)).toEqual(["b", "c"]);
    expect(grouped.done).toEqual([]);
  });
});

describe("parseBoardView", () => {
  it("keeps list and falls back to the kanban board", () => {
    expect(parseBoardView("list")).toBe("list");
    expect(parseBoardView("board")).toBe("board");
    expect(parseBoardView("kanban")).toBe("board");
    expect(parseBoardView(undefined)).toBe("board");
  });
});
