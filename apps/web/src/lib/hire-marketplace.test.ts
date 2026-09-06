import { describe, expect, it } from "vitest";
import {
  BOT_MARKETPLACE_CATALOG,
  BOT_MARKETPLACE_CATEGORIES,
} from "@groxbot/contracts";
import {
  hireMarketplaceCards,
  hireMarketplaceCategories,
} from "./hire-marketplace";

describe("hireMarketplaceCards", () => {
  it("filters by query and category", () => {
    const talent = hireMarketplaceCards({
      catalog: BOT_MARKETPLACE_CATALOG,
      query: "Talent",
      category: null,
    });
    expect(talent.some((row) => row.name === "Talent Scout")).toBe(true);

    const people = hireMarketplaceCards({
      catalog: BOT_MARKETPLACE_CATALOG,
      query: "",
      category: "People",
    });
    expect(people.length).toBeGreaterThan(0);
    expect(people.every((row) => row.category === "People")).toBe(true);

    const none = hireMarketplaceCards({
      catalog: BOT_MARKETPLACE_CATALOG,
      query: "Talent",
      category: "Finance",
    });
    expect(none).toEqual([]);
  });
});

describe("hireMarketplaceCategories", () => {
  it("lists All plus catalog categories", () => {
    expect(hireMarketplaceCategories(BOT_MARKETPLACE_CATALOG)).toEqual([
      "All",
      ...BOT_MARKETPLACE_CATEGORIES,
    ]);
  });
});
