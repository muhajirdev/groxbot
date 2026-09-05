import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TOAST_LINK_COPIED,
  TOAST_SHARED_LINK_COPIED,
  copyAndToast,
  dismissToast,
  getToast,
  subscribeToast,
  toast,
} from "./toast";

afterEach(() => {
  dismissToast();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("office toast", () => {
  it("holds the latest message and notifies subscribers", () => {
    const seen: Array<string | null> = [];
    const stop = subscribeToast(() => {
      seen.push(getToast()?.message ?? null);
    });
    toast(TOAST_SHARED_LINK_COPIED);
    toast(TOAST_LINK_COPIED);
    expect(getToast()?.message).toBe(TOAST_LINK_COPIED);
    expect(seen).toEqual([TOAST_SHARED_LINK_COPIED, TOAST_LINK_COPIED]);
    stop();
  });

  it("clears after the hold", () => {
    vi.useFakeTimers();
    toast(TOAST_LINK_COPIED);
    vi.advanceTimersByTime(2200);
    expect(getToast()).toBeNull();
  });

  it("copies then toasts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(
      copyAndToast("https://groxbot.com/s/1", TOAST_SHARED_LINK_COPIED),
    ).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://groxbot.com/s/1");
    expect(getToast()?.message).toBe(TOAST_SHARED_LINK_COPIED);
  });

  it("does not toast when copy fails", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    await expect(copyAndToast("https://x", TOAST_LINK_COPIED)).resolves.toBe(
      false,
    );
    expect(getToast()).toBeNull();
  });
});
