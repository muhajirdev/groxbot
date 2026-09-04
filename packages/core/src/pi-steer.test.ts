import { describe, expect, it } from "vitest";
import {
  drainPiQueuedUsers,
  PiSteerQueue,
  piQueuedUserBound,
} from "./pi-steer.js";

describe("PiSteerQueue", () => {
  it("drains waiting users into loop messages and matches emit order", () => {
    const queue = new PiSteerQueue();
    queue.push({
      id: "u2",
      content: "stop, list the hiring folder",
      timestamp: 2,
    });
    queue.push({ id: "u3", content: "then summarize", timestamp: 3 });
    expect(queue.drainMessages()).toEqual([
      { role: "user", content: "stop, list the hiring folder", timestamp: 2 },
      { role: "user", content: "then summarize", timestamp: 3 },
    ]);
    expect(queue.takeEmitted()?.id).toBe("u2");
    expect(queue.takeEmitted()?.id).toBe("u3");
    expect(queue.takeEmitted()).toBeUndefined();
  });

  it("keeps pending bound rows for a snapshot until the loop injects them", () => {
    const queue = new PiSteerQueue();
    queue.push({
      id: "u2",
      content: "steer",
      timestamp: 2,
      metadata: { user: { name: "Ada" } },
    });
    expect(queue.pending().map(piQueuedUserBound)).toEqual([
      {
        id: "u2",
        metadata: { user: { name: "Ada" } },
        message: { role: "user", content: "steer", timestamp: 2 },
      },
    ]);
  });
});

describe("drainPiQueuedUsers", () => {
  it("takes one or all", () => {
    const rows = [
      { id: "a", content: "a", timestamp: 1 },
      { id: "b", content: "b", timestamp: 2 },
    ];
    expect(drainPiQueuedUsers(rows, "one-at-a-time").map((row) => row.id)).toEqual(
      ["a"],
    );
    expect(drainPiQueuedUsers(rows, "all").map((row) => row.id)).toEqual(["b"]);
  });
});
