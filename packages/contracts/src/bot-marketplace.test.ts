import { describe, expect, it } from "vitest";
import {
  BOT_MARKETPLACE_CATALOG,
  BOT_MARKETPLACE_STARTER_JOBS,
  filterBotMarketplace,
  getBotMarketplaceTemplate,
  marketplaceSkillMarkdown,
  marketplaceSkillPath,
} from "./bot-marketplace.js";

describe("BOT_MARKETPLACE_CATALOG", () => {
  it("has stable unique ids and packaged soul/memory/skills", () => {
    const ids = new Set<string>();
    expect(BOT_MARKETPLACE_CATALOG.length).toBeGreaterThan(0);
    for (const row of BOT_MARKETPLACE_CATALOG) {
      expect(row.id.trim().length).toBeGreaterThan(0);
      expect(ids.has(row.id)).toBe(false);
      ids.add(row.id);
      expect(row.name.trim().length).toBeGreaterThan(0);
      expect(row.blurb.trim().length).toBeGreaterThan(0);
      expect(row.blurb.length).toBeLessThanOrEqual(160);
      expect(row.category.trim().length).toBeGreaterThan(0);
      expect(row.kind === "job" || row.kind === "person").toBe(true);
      expect(row.soul.trim().length).toBeGreaterThan(20);
      expect(row.memory.trim().length).toBeGreaterThan(10);
      expect(row.skills.length).toBeGreaterThan(0);
      for (const skill of row.skills) {
        expect(skill.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(marketplaceSkillPath(skill)).toBe(
          `skills/${skill.slug}/SKILL.md`,
        );
        expect(marketplaceSkillMarkdown(skill)).toContain(skill.name);
      }
    }
  });

  it("derives starter jobs that include Chief of Staff and skip empty names", () => {
    expect(BOT_MARKETPLACE_STARTER_JOBS).toContain("Chief of Staff");
    expect(
      BOT_MARKETPLACE_STARTER_JOBS.every((name) => name.trim().length > 0),
    ).toBe(true);
    for (const name of BOT_MARKETPLACE_STARTER_JOBS) {
      const row = BOT_MARKETPLACE_CATALOG.find(
        (item) => item.kind === "job" && item.name === name,
      );
      expect(row).toBeDefined();
      expect(row?.starter).toBe(true);
    }
  });

  it("looks up a template by id", () => {
    expect(getBotMarketplaceTemplate("chief-of-staff")?.name).toBe(
      "Chief of Staff",
    );
    expect(getBotMarketplaceTemplate("missing")).toBeUndefined();
  });
});

describe("filterBotMarketplace", () => {
  it("matches name, blurb, soul, and skills case-insensitively", () => {
    const byName = filterBotMarketplace(BOT_MARKETPLACE_CATALOG, "talent", null);
    expect(byName.some((row) => /talent/i.test(row.name))).toBe(true);

    const byBlurb = filterBotMarketplace(
      BOT_MARKETPLACE_CATALOG,
      "approval",
      null,
    );
    expect(byBlurb.length).toBeGreaterThan(0);
    expect(
      byBlurb.every(
        (row) =>
          row.name.toLowerCase().includes("approval") ||
          row.blurb.toLowerCase().includes("approval") ||
          row.soul.toLowerCase().includes("approval") ||
          row.skills.some(
            (skill) =>
              skill.name.toLowerCase().includes("approval") ||
              skill.description.toLowerCase().includes("approval") ||
              skill.body.toLowerCase().includes("approval"),
          ),
      ),
    ).toBe(true);
  });

  it("intersects category filter with search", () => {
    const category = BOT_MARKETPLACE_CATALOG[0]?.category;
    expect(category).toBeTruthy();
    const filtered = filterBotMarketplace(
      BOT_MARKETPLACE_CATALOG,
      "",
      category ?? null,
    );
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((row) => row.category === category)).toBe(true);

    const miss = filterBotMarketplace(
      BOT_MARKETPLACE_CATALOG,
      "zzzz-no-match",
      category ?? null,
    );
    expect(miss).toEqual([]);
  });
});
