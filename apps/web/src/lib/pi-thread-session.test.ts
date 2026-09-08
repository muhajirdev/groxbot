import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensurePiThread,
  forgetPiThread,
  peekPiThread,
  resetPiThreads,
  type PiHost,
  type PiThreadSubscriber,
} from "./pi-thread-session";

function fakeHost(): PiHost {
  return {
    subscribe: async () => undefined,
    send: async () => undefined,
    stop: async () => undefined,
  };
}

afterEach(() => {
  resetPiThreads();
});

describe("pi-thread-session", () => {
  it("reuses one session across ensure calls (not a React mount)", async () => {
    const connect = vi.fn(async (_url: string, _sub: PiThreadSubscriber) =>
      fakeHost(),
    );
    const a = ensurePiThread({
      threadId: "room-1",
      rpcUrl: "ws://office/rooms/room-1/rpc",
      seed: [],
      connect,
    });
    const b = ensurePiThread({
      threadId: "room-1",
      rpcUrl: "ws://office/rooms/room-1/rpc",
      connect,
    });
    expect(a).toBe(b);
    expect(peekPiThread("room-1")).toBe(a);
    await a.waitReady(2_000);
    expect(a.getSnapshot().connected).toBe(true);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("retries a failed handshake without creating a second session", async () => {
    let calls = 0;
    const connect = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error("404");
      return fakeHost();
    });
    const session = ensurePiThread({
      threadId: "room-new",
      rpcUrl: "ws://office/rooms/room-new/rpc",
      connect,
    });
    await session.waitReady(5_000);
    expect(peekPiThread("room-new")).toBe(session);
    expect(session.getSnapshot().connected).toBe(true);
    expect(calls).toBe(3);
  });

  it("drops the session only when forgotten", () => {
    const connect = vi.fn(async () => fakeHost());
    ensurePiThread({
      threadId: "room-1",
      rpcUrl: "ws://x",
      connect,
    });
    forgetPiThread("room-1");
    expect(peekPiThread("room-1")).toBeUndefined();
  });

  it("reads a snapshot from the live host", async () => {
    const connect = vi.fn(async (): Promise<PiHost> => ({
      ...fakeHost(),
      snapshot: async () => ({
        metadata: { id: "room-1", status: "idle" },
        messages: [
          {
            id: "u1",
            message: { role: "user", content: "hey", timestamp: 1 },
          },
        ],
      }),
    }));
    const session = ensurePiThread({
      threadId: "room-snap",
      rpcUrl: "ws://office/rooms/room-snap/rpc",
      connect,
    });
    await session.waitReady(2_000);
    await expect(session.fetchSnapshot()).resolves.toEqual([
      {
        id: "u1",
        message: { role: "user", content: "hey", timestamp: 1 },
      },
    ]);
  });
});
