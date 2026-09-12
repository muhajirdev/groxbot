import { getBotMarketplaceTemplate } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { HOME_HIRE_STRIP, hireApp } from "./home-hire-strip";

describe("home hire strip", () => {
  it("lists real catalog bots with at least one real app", () => {
    expect(HOME_HIRE_STRIP.length).toBeGreaterThan(8);
    expect(
      HOME_HIRE_STRIP.some((row) => row.id === "competitor-watching"),
    ).toBe(true);
    expect(HOME_HIRE_STRIP.some((row) => row.id === "clip-bot")).toBe(true);
    for (const row of HOME_HIRE_STRIP) {
      expect(getBotMarketplaceTemplate(row.id)?.id).toBe(row.id);
      expect(row.apps.length).toBeGreaterThan(0);
      const slug = row.apps[0] ?? "";
      expect(hireApp(slug).logo.length).toBeGreaterThan(0);
    }
  });
});
