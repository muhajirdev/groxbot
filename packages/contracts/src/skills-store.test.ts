import { describe, expect, it } from "vitest";
import {
  SKILLS_STORE_CATALOG,
  SKILLS_STORE_CATEGORIES,
  filterSkillsStore,
  getSkillsStoreListing,
} from "./skills-store.js";

describe("SKILLS_STORE_CATALOG", () => {
  it("has stable unique ids, short blurbs, and install sources", () => {
    const ids = new Set<string>();
    expect(SKILLS_STORE_CATALOG.length).toBeGreaterThan(10);
    for (const row of SKILLS_STORE_CATALOG) {
      expect(row.id.trim().length).toBeGreaterThan(0);
      expect(ids.has(row.id)).toBe(false);
      ids.add(row.id);
      expect(row.name.trim().length).toBeGreaterThan(0);
      expect(row.blurb.trim().length).toBeGreaterThan(0);
      expect(row.blurb.length).toBeLessThanOrEqual(120);
      expect(row.category.trim().length).toBeGreaterThan(0);
      expect(row.source.trim().length).toBeGreaterThan(0);
      expect(["official", "trusted", "community"]).toContain(row.trust);
    }
  });

  it("lists categories from the catalog", () => {
    expect(SKILLS_STORE_CATEGORIES.length).toBeGreaterThan(0);
    for (const category of SKILLS_STORE_CATEGORIES) {
      expect(
        SKILLS_STORE_CATALOG.some((row) => row.category === category),
      ).toBe(true);
    }
  });
});

describe("filterSkillsStore", () => {
  it("filters by name, blurb, and category", () => {
    const byName = filterSkillsStore(SKILLS_STORE_CATALOG, "pdf", null);
    expect(byName.some((row) => row.id === "anthropic-pdf")).toBe(true);

    const byBlurb = filterSkillsStore(SKILLS_STORE_CATALOG, "playwright", null);
    expect(byBlurb.some((row) => /playwright/i.test(row.blurb))).toBe(true);

    const engineering = filterSkillsStore(
      SKILLS_STORE_CATALOG,
      "",
      "Engineering",
    );
    expect(engineering.length).toBeGreaterThan(0);
    expect(engineering.every((row) => row.category === "Engineering")).toBe(
      true,
    );

    expect(filterSkillsStore(SKILLS_STORE_CATALOG, "zzznomatch", null)).toEqual(
      [],
    );
  });

  it("resolves listings by id", () => {
    expect(getSkillsStoreListing("anthropic-pdf")?.name).toBe("PDF");
    expect(getSkillsStoreListing("missing")).toBeUndefined();
  });
});
