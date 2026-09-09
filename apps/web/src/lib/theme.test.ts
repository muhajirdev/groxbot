import { afterEach, describe, expect, it } from "vitest";
import { OFFICE_COLOR_KEY } from "./office-color";
import {
  applyTheme,
  readTheme,
  syncChrome,
  THEME_KEY,
  watchSystemTheme,
} from "./theme";

const memory = new Map<string, string>();
let systemDark = false;
let systemListener: (() => void) | undefined;

Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  },
  configurable: true,
});

Object.defineProperty(globalThis, "document", {
  value: { documentElement: { dataset: {} as Record<string, string> } },
  configurable: true,
});

Object.defineProperty(globalThis, "window", {
  value: {
    matchMedia: (query: string) => ({
      matches: query.includes("dark") ? systemDark : !systemDark,
      addEventListener: (_event: string, listener: () => void) => {
        systemListener = listener;
      },
      removeEventListener: (_event: string, listener: () => void) => {
        if (systemListener === listener) systemListener = undefined;
      },
    }),
  },
  configurable: true,
});

describe("theme", () => {
  afterEach(() => {
    memory.clear();
    systemDark = false;
    systemListener = undefined;
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.officeColor;
  });

  it("defaults to dark for existing users", () => {
    expect(readTheme()).toBe("dark");
  });

  it("switches incompatible looks to a complete light workspace", () => {
    localStorage.setItem(OFFICE_COLOR_KEY, "night");

    expect(applyTheme("light")).toBe("snow");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    expect(localStorage.getItem(OFFICE_COLOR_KEY)).toBe("snow");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.officeColor).toBe("snow");
  });

  it("keeps a compatible expressive look", () => {
    localStorage.setItem(OFFICE_COLOR_KEY, "paper");
    expect(applyTheme("light")).toBe("paper");
  });

  it("follows live system changes without losing System mode", () => {
    localStorage.setItem(OFFICE_COLOR_KEY, "linear");
    applyTheme("system");
    const stop = watchSystemTheme();

    expect(document.documentElement.dataset.theme).toBe("light");
    systemDark = true;
    systemListener?.();

    expect(localStorage.getItem(THEME_KEY)).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.officeColor).toBe("linear");
    stop();
    expect(systemListener).toBeUndefined();
  });

  it("boots a stored look when there is no explicit theme preference", () => {
    localStorage.setItem(OFFICE_COLOR_KEY, "blush");
    expect(syncChrome()).toBe("blush");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
