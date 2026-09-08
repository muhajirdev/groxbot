import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readDebugMode,
  writeDebugMode,
} from "./debug-mode";
import {
  appendOfficeDebugLine,
  clearOfficeDebugLines,
  readOfficeDebugLines,
} from "./office-debug";

const store = new Map<string, string>();

afterEach(() => {
  store.clear();
  clearOfficeDebugLines("room-1");
  vi.unstubAllGlobals();
});

describe("debug mode", () => {
  it("toggles localStorage", () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    vi.stubGlobal("window", {
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    writeDebugMode(true);
    expect(readDebugMode()).toBe(true);
    writeDebugMode(false);
    expect(readDebugMode()).toBe(false);
  });
});

describe("office debug lines", () => {
  it("keeps raw lines when debug is on", () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    vi.stubGlobal("window", {
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    writeDebugMode(true);
    appendOfficeDebugLine("room-1", "turn_start +0ms");
    appendOfficeDebugLine("room-1", "bot_loaded +12ms");
    expect(readOfficeDebugLines("room-1")).toEqual([
      "turn_start +0ms",
      "bot_loaded +12ms",
    ]);
    clearOfficeDebugLines("room-1");
    expect(readOfficeDebugLines("room-1")).toEqual([]);
  });

  it("ignores lines when debug is off", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "0",
      setItem: () => {},
      removeItem: () => {},
    });
    vi.stubGlobal("window", {
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    appendOfficeDebugLine("room-1", "turn_start +0ms");
    expect(readOfficeDebugLines("room-1")).toEqual([]);
  });
});
