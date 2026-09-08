import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CRISP_SCRIPT_SRC,
  CRISP_WEBSITE_ID,
  crispIdentifyCommands,
  openCrispChat,
} from "./support-chat";

describe("support chat", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses the Groxbot Crisp website", () => {
    expect(CRISP_WEBSITE_ID).toBe("c6116033-f9f2-4980-8ae3-0a4f0fed8852");
    expect(CRISP_SCRIPT_SRC).toBe("https://client.crisp.chat/l.js");
  });

  it("skips blank identity", () => {
    expect(crispIdentifyCommands()).toEqual([]);
    expect(crispIdentifyCommands({ email: "  ", name: "" })).toEqual([]);
  });

  it("sets email and name when present", () => {
    expect(
      crispIdentifyCommands({
        email: "you@groxbot.com",
        name: "You",
      }),
    ).toEqual([
      ["set", "user:email", ["you@groxbot.com"]],
      ["set", "user:nickname", ["You"]],
    ]);
  });

  it("boots Crisp hidden, then opens the messenger", () => {
    const scripts: Array<{ src: string; async: boolean }> = [];
    const win: { $crisp?: unknown[]; CRISP_WEBSITE_ID?: string } = {};
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", {
      querySelector: () => null,
      createElement: () => ({ src: "", async: false }),
      head: {
        appendChild: (el: { src: string; async: boolean }) => {
          scripts.push(el);
        },
      },
    });

    openCrispChat({ email: "you@groxbot.com", name: "You" });

    expect(win.CRISP_WEBSITE_ID).toBe(CRISP_WEBSITE_ID);
    expect(win.$crisp?.[0]).toEqual(["safe", true]);
    expect(win.$crisp?.[1]).toEqual(["do", "chat:hide"]);
    expect(win.$crisp?.at(-2)).toEqual(["do", "chat:show"]);
    expect(win.$crisp?.at(-1)).toEqual(["do", "chat:open"]);
    expect(scripts).toEqual([{ src: CRISP_SCRIPT_SRC, async: true }]);

    openCrispChat();
    expect(scripts).toHaveLength(1);
  });

  it("does not replace a live Crisp client", () => {
    const push = vi.fn();
    const live = { push };
    const win = { $crisp: live, CRISP_WEBSITE_ID: "old" };
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", {
      querySelector: () => ({}),
      createElement: () => ({ src: "", async: false }),
      head: { appendChild: vi.fn() },
    });

    openCrispChat();

    expect(win.$crisp).toBe(live);
    expect(push).toHaveBeenCalledWith(["do", "chat:show"]);
    expect(push).toHaveBeenCalledWith(["do", "chat:open"]);
  });

  it("cancels a close-hide when opened again", () => {
    vi.useFakeTimers();
    const win: { $crisp?: unknown[] } = {};
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", {
      querySelector: () => null,
      createElement: () => ({ src: "", async: false }),
      head: { appendChild: vi.fn() },
    });

    openCrispChat();
    const closed = win.$crisp?.find(
      (command) =>
        Array.isArray(command) &&
        command[0] === "on" &&
        command[1] === "chat:closed",
    ) as [string, string, () => void] | undefined;
    expect(closed?.[2]).toBeTypeOf("function");

    closed?.[2]();
    openCrispChat();
    vi.runAllTimers();

    expect(
      win.$crisp?.filter(
        (command) => Array.isArray(command) && command[1] === "chat:hide",
      ),
    ).toHaveLength(1);
    expect(win.$crisp?.at(-1)).toEqual(["do", "chat:open"]);
  });
});
