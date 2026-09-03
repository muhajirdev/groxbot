import { describe, expect, it, vi } from "vitest";
import { waitForAgentReady } from "./agent-ready";

describe("waitForAgentReady", () => {
  it("returns immediately when the socket is already identified", async () => {
    await waitForAgentReady(() => ({
      identified: true,
      ready: new Promise(() => {}),
    }));
  });

  it("follows a replaced ready promise after reconnect", async () => {
    let resolveReady: (() => void) | undefined;
    const first = new Promise<void>(() => {});
    let handle = { identified: false, ready: first };
    const done = waitForAgentReady(() => handle, { intervalMs: 10 });
    handle = {
      identified: false,
      ready: new Promise<void>((resolve) => {
        resolveReady = resolve;
      }),
    };
    handle = { identified: true, ready: handle.ready };
    resolveReady?.();
    await done;
  });

  it("times out if identity never arrives", async () => {
    vi.useFakeTimers();
    try {
      const pending = waitForAgentReady(
        () => ({ identified: false, ready: new Promise(() => {}) }),
        { timeoutMs: 100, intervalMs: 20 },
      );
      const expectTimeout = expect(pending).rejects.toThrow(
        "Could not reach this teammate. Try sending again.",
      );
      await vi.advanceTimersByTimeAsync(120);
      await expectTimeout;
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts when the signal fires", async () => {
    const controller = new AbortController();
    const pending = waitForAgentReady(
      () => ({ identified: false, ready: new Promise(() => {}) }),
      { signal: controller.signal, intervalMs: 20 },
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
