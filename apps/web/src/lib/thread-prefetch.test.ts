import { describe, expect, it } from "vitest";
import type { PiBoundMessage } from "@groxbot/core/browser";
import {
  prefetchThreadTargets,
  threadPrefetchTargets,
  type ThreadPrefetchTarget,
} from "./thread-prefetch";

const user = (id: string): PiBoundMessage => ({
  id,
  message: { role: "user", content: "hi", timestamp: 1 },
});

describe("threadPrefetchTargets", () => {
  it("queues live homes and group rooms that are still cold", () => {
    expect(
      threadPrefetchTargets({
        bots: [
          { id: "bot-a", homeRoomId: "home-a" },
          { id: "bot-b", homeRoomId: "home-b", archivedAt: "2026-01-01" },
          { id: "bot-c" },
        ],
        rooms: [{ id: "board-1" }, { id: "home-a" }],
        skipRoomIds: ["home-a"],
        hasOffice: (id) => id === "cached",
        hasRoom: () => false,
      }),
    ).toEqual([
      { kind: "office", roomId: "bot-c" },
      { kind: "room", roomId: "board-1" },
    ]);
  });

  it("skips a teammate whose office is already in the bag", () => {
    expect(
      threadPrefetchTargets({
        bots: [{ id: "bot-a", homeRoomId: "home-a" }],
        rooms: [],
        hasOffice: (id) => id === "home-a",
        hasRoom: () => false,
      }),
    ).toEqual([]);
  });
});

describe("prefetchThreadTargets", () => {
  it("stores snapshots in the background without failing the batch", async () => {
    const stored: ThreadPrefetchTarget[] = [];
    const seen: string[] = [];
    await prefetchThreadTargets(
      [
        { kind: "office", roomId: "a" },
        { kind: "room", roomId: "b" },
        { kind: "office", roomId: "c" },
      ],
      {
        concurrency: 2,
        fetch: async (roomId) => {
          seen.push(roomId);
          if (roomId === "b") throw new Error("offline");
          return [user(roomId)];
        },
        store: (target) => {
          stored.push(target);
        },
      },
    );
    expect(seen.sort()).toEqual(["a", "b", "c"]);
    expect(stored.map((row) => row.roomId).sort()).toEqual(["a", "c"]);
  });

  it("stops starting new fetches when cancelled", async () => {
    let started = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let sawFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      sawFirst = resolve;
    });
    const run = prefetchThreadTargets(
      [
        { kind: "office", roomId: "a" },
        { kind: "office", roomId: "b" },
      ],
      {
        concurrency: 1,
        isCancelled: () => started >= 1,
        fetch: async () => {
          started += 1;
          sawFirst();
          await gate;
          return [];
        },
        store: () => {},
      },
    );
    await first;
    release();
    await run;
    expect(started).toBe(1);
  });
});
