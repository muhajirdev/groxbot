import { describe, expect, it } from "vitest";
import { SKILLS_STORE_CATALOG } from "@groxbot/contracts";
import {
  skillsStoreCards,
  skillsStoreCategories,
  skillsStoreTrustLabel,
} from "./skills-store";

describe("skillsStoreCards", () => {
  it("filters the curated catalog", () => {
    expect(
      skillsStoreCards({ query: "pdf", category: null }).some(
        (row) => row.id === "anthropic-pdf",
      ),
    ).toBe(true);
    expect(
      skillsStoreCards({ query: "", category: "Research" }).every(
        (row) => row.category === "Research",
      ),
    ).toBe(true);
  });
});

describe("skillsStoreCategories", () => {
  it("puts All first", () => {
    const categories = skillsStoreCategories(SKILLS_STORE_CATALOG);
    expect(categories[0]).toBe("All");
    expect(categories.length).toBeGreaterThan(2);
  });
});

describe("skillsStoreTrustLabel", () => {
  it("labels trust tiers", () => {
    expect(skillsStoreTrustLabel("trusted")).toBe("Trusted");
    expect(skillsStoreTrustLabel("community")).toBe("Community");
    expect(skillsStoreTrustLabel("official")).toBe("Official");
  });
});
