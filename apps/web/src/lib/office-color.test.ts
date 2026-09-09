import { afterEach, describe, expect, it } from "vitest";
import {
  applyOfficeColor,
  DEFAULT_OFFICE_COLOR,
  OFFICE_COLOR_KEY,
  OFFICE_COLORS,
  officeColorForAppearance,
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

  it("defaults to linear", () => {
    expect(readOfficeColor()).toBe(DEFAULT_OFFICE_COLOR);
    expect(DEFAULT_OFFICE_COLOR).toBe("linear");
  });

  it("ignores unknown values", () => {
    localStorage.setItem(OFFICE_COLOR_KEY, "neon");
    expect(readOfficeColor()).toBe("linear");
  });

  it("maps a legacy light hue to paper", () => {
    localStorage.setItem(OFFICE_COLOR_KEY, "dust");
    expect(readOfficeColor()).toBe("paper");
  });

  it("maps a retired look onto a current one", () => {
    localStorage.setItem(OFFICE_COLOR_KEY, "dusk");
    expect(readOfficeColor()).toBe("linear");
  });

  it("uses snow when only the old light theme is set", () => {
    localStorage.setItem("groxbot.theme", "light");
    expect(readOfficeColor()).toBe("snow");
  });

  it("remembers a color", () => {
    applyOfficeColor("snow");
    expect(localStorage.getItem(OFFICE_COLOR_KEY)).toBe("snow");
    expect(localStorage.getItem("groxbot.theme")).toBe("light");
    expect(readOfficeColor()).toBe("snow");
  });

  it("moves incompatible looks to the first-class light or dark defaults", () => {
    expect(officeColorForAppearance("light", "night")).toBe("snow");
    expect(officeColorForAppearance("dark", "paper")).toBe("linear");
    expect(officeColorForAppearance("light", "paper")).toBe("paper");
    expect(officeColorForAppearance("dark", "night")).toBe("night");
  });

  it("lists office looks", () => {
    expect(OFFICE_COLORS.map((color) => color.id)).toEqual([
      "snow",
      "linear",
      "night",
      "paper",
      "blush",
    ]);
    expect(OFFICE_COLORS.find((color) => color.id === "linear")?.blurb).toBe(
      "Charcoal, quiet chrome",
    );
    expect(OFFICE_COLORS.find((color) => color.id === "snow")?.label).toBe(
      "Light",
    );
    expect(OFFICE_COLORS.find((color) => color.id === "snow")?.rail).toBe(
      "#f2f1ed",
    );
  });
});
