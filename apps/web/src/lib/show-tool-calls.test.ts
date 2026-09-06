import { afterEach, describe, expect, it } from "vitest";
import {
  readShowToolCalls,
  SHOW_TOOL_CALLS_KEY,
  writeShowToolCalls,
} from "./show-tool-calls";

const memory = new Map<string, string>();
const localStorageStub = {
  getItem(key: string) {
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
  },
  removeItem(key: string) {
    memory.delete(key);
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageStub,
  configurable: true,
});

describe("show tool calls", () => {
  afterEach(() => {
    memory.clear();
  });

  it("is off unless the localStorage flag is 1", () => {
    expect(readShowToolCalls()).toBe(false);
    localStorage.setItem(SHOW_TOOL_CALLS_KEY, "0");
    expect(readShowToolCalls()).toBe(false);
    writeShowToolCalls(true);
    expect(localStorage.getItem(SHOW_TOOL_CALLS_KEY)).toBe("1");
    expect(readShowToolCalls()).toBe(true);
    writeShowToolCalls(false);
    expect(readShowToolCalls()).toBe(false);
  });
});
