import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FEATURED_PLUGIN_IDS,
  featuredPluginCards,
  marketplaceBrowseSections,
  marketplaceChipSplit,
  marketplaceInstalledSummary,
  marketplaceSearchPlaceholder,
} from "./marketplace";
import type { PluginCard } from "./plugins";

const modalSrc = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../components/MarketplaceModal.tsx",
  ),
  "utf8",
);

const gmail: PluginCard = {
  id: "gmail",
  name: "Gmail",
  blurb: "Mail",
  category: "Productivity",
  kind: "connector",
};

const slack: PluginCard = {
  id: "slack",
  name: "Slack",
  blurb: "Chat",
  category: "Communication",
  kind: "connector",
};

const obscure: PluginCard = {
  id: "obscure-app",
  name: "Obscure",
  blurb: "Other",
  category: "Other",
  kind: "connector",
};

describe("marketplaceInstalledSummary", () => {
  it("formats installed and private counts", () => {
    expect(
      marketplaceInstalledSummary({ installed: 10, privateCount: 2 }),
    ).toBe("10 installed · 2 private");
    expect(marketplaceInstalledSummary({ installed: 1, privateCount: 0 })).toBe(
      "1 installed",
    );
  });
});

describe("marketplaceChipSplit", () => {
  it("keeps short lists intact and overflows the rest", () => {
    expect(marketplaceChipSplit(["A", "B"], 5)).toEqual({
      shown: ["A", "B"],
      more: [],
    });
    expect(
      marketplaceChipSplit(["A", "B", "C", "D", "E", "F", "G"], 3),
    ).toEqual({
      shown: ["A", "B", "C"],
      more: ["D", "E", "F", "G"],
    });
  });
});

describe("featuredPluginCards", () => {
  it("pins known ids first then fills", () => {
    const cards = featuredPluginCards([obscure, slack, gmail], 2);
    expect(cards.map((item) => item.id)).toEqual(["gmail", "slack"]);
    expect(FEATURED_PLUGIN_IDS[0]).toBe("gmail");
  });
});

describe("marketplaceBrowseSections", () => {
  it("puts Featured first on All, then a few category previews", () => {
    const sections = marketplaceBrowseSections({
      items: [gmail, slack, obscure],
      featured: [gmail, slack],
      category: null,
      query: "",
      preview: 1,
      maxCategorySections: 2,
    });
    expect(sections.map((row) => row.key)).toEqual(["featured", "Other"]);
    expect(sections[1]?.hasMore).toBe(false);
  });

  it("flattens search to Results", () => {
    const sections = marketplaceBrowseSections({
      items: [gmail],
      featured: [gmail],
      category: null,
      query: "mail",
    });
    expect(sections).toEqual([
      {
        key: "matches",
        title: "Results",
        items: [gmail],
        hasMore: false,
      },
    ]);
  });
});

describe("marketplaceSearchPlaceholder", () => {
  it("matches the surface", () => {
    expect(marketplaceSearchPlaceholder("plugins")).toContain("plugins");
    expect(marketplaceSearchPlaceholder("bots")).toContain("bots");
    expect(marketplaceSearchPlaceholder("skills")).toContain("skills");
  });
});

describe("marketplace sheet chrome", () => {
  it("keeps the Marketplace title out of the tab row", () => {
    expect(modalSrc).toContain('className="market-head"');
    expect(modalSrc).toContain('className="market-title"');
    expect(modalSrc).toContain("market-head-tools");
    expect(modalSrc).not.toMatch(
      /flex-1 text-\[16px\] font-semibold tracking-tight/,
    );
  });
});
