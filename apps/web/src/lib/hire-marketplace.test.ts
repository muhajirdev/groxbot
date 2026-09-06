import { describe, expect, it } from "vitest";
import {
  BOT_MARKETPLACE_CATALOG,
  BOT_MARKETPLACE_CATEGORIES,
} from "@groxbot/contracts";
import {
  hireMarketplaceCards,
  hireMarketplaceCategories,
  marketplaceAvatar,
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

  it("opens on a short starter list", () => {
    const cards = hireMarketplaceCards({
      catalog: BOT_MARKETPLACE_CATALOG,
      query: "",
      category: null,
    });
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThan(16);
    expect(cards.every((row) => row.starter)).toBe(true);
  });

  it("can show the full catalog", () => {
    const cards = hireMarketplaceCards({
      catalog: BOT_MARKETPLACE_CATALOG,
      query: "",
      category: null,
      all: true,
    });
    expect(cards.length).toBe(BOT_MARKETPLACE_CATALOG.length);
  });
});

describe("marketplaceAvatar", () => {
  it("keeps a stable face per template", () => {
    const a = marketplaceAvatar("chief-of-staff");
    const b = marketplaceAvatar("chief-of-staff");
    const c = marketplaceAvatar("talent-scout");
    expect(a).toEqual(b);
    expect(`${a.color}:${a.shape}`).not.toBe(`${c.color}:${c.shape}`);
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
