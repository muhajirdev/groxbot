import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INDIE_INTEGRATIONS } from "../data/indie-integrations";
import { USE_CASES } from "../data/use-cases";
import { categoryFamily } from "./category-copy";
import { FOOTER_BLURB, TAGLINE, THESES } from "./copy";
import { DISCOVERY_SITEMAP_PATHS, landingLlmsTxt } from "./discovery";
import {
  computerIntegrations,
  getIntegration,
  INTEGRATIONS,
  integrationCategories,
  relatedIntegrations,
  searchIntegrations,
} from "./integrations";
import { canonicalUrl, DEFAULT_DESCRIPTION, DEFAULT_TITLE } from "./site";
import { sitemapEntries, sitemapXml } from "./sitemap";
import { slugify } from "./slug";

describe("slugify", () => {
  it("turns categories into url slugs", () => {
    expect(slugify("developer tools")).toBe("developer-tools");
    expect(slugify("ads & conversion")).toBe("ads-and-conversion");
  });
});

describe("integrations catalog", () => {
  it("snapshots Composio toolkits plus indie computer integrations", () => {
    expect(getIntegration("gmail")?.kind).toBe("composio");
    expect(getIntegration("gmail")?.toolCount).toBeGreaterThan(0);
    expect(getIntegration("datafast")?.kind).toBe("computer");
    expect(getIntegration("postiz")?.kind).toBe("computer");
    expect(getIntegration("post-bridge")?.founder).toBe("Jack Friks");
    expect(INTEGRATIONS.length).toBeGreaterThan(1000);
  });

  it("does not let indie slugs collide with Composio", () => {
    const composioSlugs = new Set(
      INTEGRATIONS.filter((item) => item.kind === "composio").map(
        (item) => item.slug,
      ),
    );
    for (const item of INDIE_INTEGRATIONS) {
      expect(composioSlugs.has(item.slug)).toBe(false);
    }
  });

  it("varies copy by category family", () => {
    const gmail = getIntegration("gmail");
    const github = getIntegration("github");
    expect(gmail).toBeDefined();
    expect(github).toBeDefined();
    if (!gmail || !github) return;
    expect(categoryFamily(gmail.category)).toBe("email");
    expect(categoryFamily(github.category)).toBe("code");
    expect(gmail.firstMessage).not.toBe(github.firstMessage);
    expect(gmail.how[0]).not.toBe(github.how[0]);
  });

  it("finds related tools in the same category", () => {
    const gmail = getIntegration("gmail");
    expect(gmail).toBeDefined();
    if (!gmail) return;
    const related = relatedIntegrations(gmail, 4);
    expect(related.length).toBeGreaterThan(0);
    expect(related.some((item) => item.slug === "gmail")).toBe(false);
  });

  it("searches indie founders and product names", () => {
    expect(
      searchIntegrations("marc lou").some((item) => item.slug === "datafast"),
    ).toBe(true);
    expect(searchIntegrations("post bridge")[0]?.slug).toBe("post-bridge");
  });

  it("lists computer integrations separately", () => {
    const slugs = computerIntegrations().map((item) => item.slug);
    expect(slugs).toEqual(
      expect.arrayContaining(["datafast", "postiz", "post-bridge", "shipfast"]),
    );
  });

  it("gives every integration a logo, with hosted files for computer tools", () => {
    const missing = INTEGRATIONS.filter((item) => !item.logo).map(
      (item) => item.slug,
    );
    expect(missing).toEqual([]);
    const logosDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../public/logos",
    );
    for (const item of computerIntegrations()) {
      expect(item.logo).toBe(`/logos/${item.slug}.png`);
      expect(existsSync(join(logosDir, `${item.slug}.png`))).toBe(true);
    }
  });
});

describe("use cases", () => {
  it("points at real integrations", () => {
    for (const useCase of USE_CASES) {
      for (const slug of useCase.integrationSlugs) {
        expect(getIntegration(slug), slug).toBeDefined();
      }
    }
  });
});

describe("sitemap", () => {
  it("includes hubs, categories, integrations, use cases, and compare pages", async () => {
    const { COMPARE_PAGES } = await import("../data/compare");
    const paths = sitemapEntries().map((entry) => entry.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/integrations");
    expect(paths).toContain("/use-cases");
    expect(paths).toContain("/compare");
    expect(paths).toContain(
      "/compare/grok-bot-vs-hermes-vs-openclaw-vs-paperclip",
    );
    expect(paths).toContain("/compare/grok-bot-vs-hermes");
    expect(paths).toContain("/compare/grok-bot-vs-openclaw");
    expect(paths).toContain("/compare/grok-bot-vs-paperclip");
    expect(paths).toContain("/press");
    expect(paths).toContain("/press.md");
    expect(paths).toContain("/integrations/gmail");
    expect(paths).toContain("/integrations/datafast");
    expect(paths).toContain("/use-cases/indie-stack");
    expect(
      paths.some((path) => path.startsWith("/integrations/category/")),
    ).toBe(true);
    expect(paths).toContain("/llms.txt");
    expect(paths).toContain("/mcp");
    expect(paths.some((path) => path.startsWith("/s/"))).toBe(false);
    expect(paths.length).toBe(
      5 +
        DISCOVERY_SITEMAP_PATHS.length +
        integrationCategories().length +
        INTEGRATIONS.length +
        USE_CASES.length +
        COMPARE_PAGES.length,
    );
  });

  it("emits xml with canonical groxbot.com urls", () => {
    const xml = sitemapXml();
    expect(xml).toContain(canonicalUrl("/integrations/postiz"));
    expect(xml).toContain(
      canonicalUrl("/compare/grok-bot-vs-hermes-vs-openclaw-vs-paperclip"),
    );
    expect(xml).toContain(canonicalUrl("/compare/grok-bot-vs-hermes"));
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });
});

describe("compare pages", () => {
  it("ships the four-way page plus every pairwise vs", async () => {
    const { COMPARE_PAGES, FEATURE_ROWS, getComparePage } = await import(
      "../data/compare"
    );
    const page = getComparePage(
      "grok-bot-vs-hermes-vs-openclaw-vs-paperclip",
    );
    expect(page).toBeDefined();
    expect(COMPARE_PAGES).toHaveLength(7);
    expect(COMPARE_PAGES.map((item) => item.slug)).toEqual(
      expect.arrayContaining([
        "grok-bot-vs-hermes-vs-openclaw-vs-paperclip",
        "grok-bot-vs-hermes",
        "grok-bot-vs-openclaw",
        "grok-bot-vs-paperclip",
        "hermes-vs-openclaw",
        "hermes-vs-paperclip",
        "openclaw-vs-paperclip",
      ]),
    );
    expect(page?.products.map((item) => item.id)).toEqual([
      "groxbot",
      "hermes",
      "openclaw",
      "paperclip",
    ]);
    expect(page?.products.some((item) => item.ours)).toBe(true);
    expect(page?.faqs.length).toBeGreaterThan(2);
    expect(FEATURE_ROWS.map((row) => row.label)).toEqual(
      expect.arrayContaining([
        "Multiplayer",
        "Shared knowledge base",
        "Open source",
        "Mobile app",
        "Use any model",
        "Bring your own key",
        "Self-evolving agent",
        "Self-improving organization",
      ]),
    );
    expect(FEATURE_ROWS.find((row) => row.label === "Multiplayer")?.values.groxbot).toBe(
      true,
    );
    expect(
      FEATURE_ROWS.find((row) => row.label === "Shared knowledge base")?.values
        .hermes,
    ).not.toBe(true);
    for (const row of page?.rows ?? []) {
      expect(Object.keys(row.values).sort()).toEqual([
        "groxbot",
        "hermes",
        "openclaw",
        "paperclip",
      ]);
    }
    const pair = getComparePage("grok-bot-vs-hermes");
    expect(pair?.products.map((item) => item.id)).toEqual([
      "groxbot",
      "hermes",
    ]);
    for (const row of pair?.rows ?? []) {
      expect(Object.keys(row.values).sort()).toEqual(["groxbot", "hermes"]);
    }
  });
});

describe("llms discovery", () => {
  it("names Groxbot and points agents at MCP plus use cases", () => {
    const txt = landingLlmsTxt();
    expect(txt.startsWith("# Groxbot\n")).toBe(true);
    expect(txt).toContain("/mcp");
    expect(txt).toContain("/identity.json");
    expect(txt).toContain("/use-cases/");
    expect(txt).toContain("/compare/");
    expect(txt).toContain("/press");
  });

  it("leads public copy with AI is better together", () => {
    expect(TAGLINE).toBe("AI is better together");
    expect(DEFAULT_TITLE).toBe("Groxbot — AI is better together");
    expect(DEFAULT_DESCRIPTION).toMatch(/^AI is better together\./);
    expect(FOOTER_BLURB).toMatch(/^AI is better together\./);
    expect(landingLlmsTxt()).toContain("AI is better together");
  });

  it("gives each landing thesis its own section headline", () => {
    expect(THESES.map((item) => item.id)).toEqual([
      "together",
      "adopt",
      "knowledge",
      "phone",
    ]);
    expect(THESES.map((item) => item.title)).toEqual([
      "AI is better together.",
      "The best way to get your team to adopt AI is to track it.",
      "The company’s knowledge base should evolve from group chats.",
      "You should be able to work from your phone.",
    ]);
    expect(THESES[3]?.why).toMatch(/anytime, anywhere/);
    expect(THESES[3]?.why).toMatch(/good decisions and good ideas/);
  });
});
