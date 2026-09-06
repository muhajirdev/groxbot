import { afterEach, describe, expect, it } from "vitest";
import {
  applyOfficeColor,
  DEFAULT_OFFICE_COLOR,
  OFFICE_COLOR_KEY,
  OFFICE_COLORS,
  readOfficeColor,
} from "./office-color";

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

describe("office color", () => {
  afterEach(() => {
    memory.clear();
  });

  it("defaults to dusk", () => {
    expect(readOfficeColor()).toBe(DEFAULT_OFFICE_COLOR);
  });

  it("ignores unknown values", () => {
    localStorage.setItem(OFFICE_COLOR_KEY, "neon");
    expect(readOfficeColor()).toBe("dusk");
  });

  it("maps a legacy light hue to paper", () => {
    localStorage.setItem(OFFICE_COLOR_KEY, "dust");
    expect(readOfficeColor()).toBe("paper");
  });

  it("uses paper when only the old light theme is set", () => {
    localStorage.setItem("groxbot.theme", "light");
    expect(readOfficeColor()).toBe("paper");
  });

  it("remembers a color", () => {
    applyOfficeColor("blush");
    expect(localStorage.getItem(OFFICE_COLOR_KEY)).toBe("blush");
    expect(localStorage.getItem("groxbot.theme")).toBe("light");
    expect(readOfficeColor()).toBe("blush");
  });

  it("is four distinct looks", () => {
    expect(OFFICE_COLORS.map((color) => color.id)).toEqual([
      "night",
      "dusk",
      "paper",
      "blush",
    ]);
  });
});
