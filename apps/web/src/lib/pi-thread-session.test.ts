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
    focus: async () => undefined,
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

  it("forwards a pending approval decision to the live host", async () => {
    const approveApproval = vi.fn(async () => ({ status: "completed" }));
    const rejectApproval = vi.fn(async () => ({ rejected: true }));
    const pendingApprovals = vi.fn(async () => [
      { executionId: "exec_1", seq: 2, connector: "bots", method: "hire" },
    ]);
    const session = ensurePiThread({
      threadId: "room-approval",
      rpcUrl: "ws://office/rooms/room-approval/rpc",
      connect: vi.fn(async () => ({
        ...fakeHost(),
        pendingApprovals,
        approveApproval,
        rejectApproval,
      })),
    });
    await session.waitReady(2_000);
    await expect(session.pendingApprovals()).resolves.toHaveLength(1);
    await session.approveApproval("exec_1");
    await session.rejectApproval("exec_1", 2);
    expect(approveApproval).toHaveBeenCalledWith("exec_1");
    expect(rejectApproval).toHaveBeenCalledWith("exec_1", 2);
  });

  it("clears a turn error when the actor starts or completes a later turn", async () => {
    let subscriber!: PiThreadSubscriber;
    const session = ensurePiThread({
      threadId: "room-error",
      rpcUrl: "ws://office/rooms/room-error/rpc",
      connect: vi.fn(async (_url: string, next: PiThreadSubscriber) => {
        subscriber = next;
        return fakeHost();
      }),
    });
    await session.waitReady(2_000);

    subscriber.error("Response validation failed");
    expect(session.getSnapshot().error?.message).toBe(
      "Response validation failed",
    );

    subscriber.status("submitted");
    expect(session.getSnapshot().error).toBeUndefined();
    expect(session.getSnapshot().view.error).toBe("");
  });

  it("sets the room live app on the host", async () => {
    const focus = vi.fn(async () => undefined);
    const session = ensurePiThread({
      threadId: "room-focus",
      rpcUrl: "ws://office/rooms/room-focus/rpc",
      connect: vi.fn(async (): Promise<PiHost> => ({
        ...fakeHost(),
        focus,
      })),
    });
    await session.focus("app_q3");
    expect(session.getSnapshot().view.focusedAppId).toBe("app_q3");
    expect(focus).toHaveBeenCalledWith("app_q3");
    await session.focus("");
    expect(session.getSnapshot().view.focusedAppId).toBe("");
    expect(focus).toHaveBeenCalledWith("");
  });
});
