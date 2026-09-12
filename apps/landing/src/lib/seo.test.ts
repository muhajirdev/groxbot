import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INDIE_INTEGRATIONS } from "../data/indie-integrations";
import { USE_CASES } from "../data/use-cases";
import { categoryFamily } from "./category-copy";
import {
  FOOTER_BLURB,
  HERO_COMPARE_NAMES,
  HERO_DEMO,
  TALK_DEMO,
  HERO_HEADLINE,
  ADOPT_HEADLINE,
  ADOPT_POINTS,
  HOW_HEADLINE,
  HIRE_BEAT_HEADLINE,
  INVITE_HEADLINE,
  RUNS_HEADLINE,
  JOBS_HEADLINE,
  KNOW_HEADLINE,
  KNOW_POINTS,
  APPS_HEADLINE,
  APPS_LEDE,
  APPS_TOOLS,
  MEET_CHANNELS,
  MEET_HEADLINE,
  PHONE_HEADLINE,
  PHONE_LEDE,
  TALK_HEADLINE,
  TALK_LEDE,
  TALK_POINTS,
  HERO_LEDE,
  HERO_PLATFORMS_LINE,
  HERO_PITCH,
  STORY,
  TAGLINE,
  THESES,
  FAQS,
} from "./copy";
import {
  DISCOVERY_SITEMAP_PATHS,
  discoveryResponse,
  landingLlmsTxt,
} from "./discovery";
import {
  computerIntegrations,
  formatIntegrationCount,
  getIntegration,
  INTEGRATIONS,
  integrationCategories,
  relatedIntegrations,
  searchIntegrations,
} from "./integrations";
import {
  canonicalUrl,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  seoHead,
} from "./site";
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
    expect(formatIntegrationCount()).toMatch(/^\d{1,3}(,\d{3})?\+$/);
    expect(formatIntegrationCount()).not.toMatch(/composio/i);
    expect(Number(formatIntegrationCount().replace(/[+,]/g, ""))).toBeLessThanOrEqual(
      INTEGRATIONS.length,
    );
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

  it("covers Gumloop-parity jobs across categories", async () => {
    const { USE_CASE_CATEGORIES } = await import("../data/use-cases");
    expect(USE_CASES.length).toBeGreaterThanOrEqual(30);
    expect(USE_CASES.map((item) => item.slug)).toEqual(
      expect.arrayContaining([
        "content-creation",
        "lead-generation",
        "seo-automation",
        "meeting-prep",
        "support-triage",
        "shopify-ops",
        "call-analysis",
      ]),
    );
    for (const category of USE_CASE_CATEGORIES) {
      expect(
        USE_CASES.some((item) => item.category === category.id),
        category.id,
      ).toBe(true);
    }
  });
});

describe("sitemap", () => {
  it("includes hubs, categories, integrations, use cases, and compare pages", async () => {
    const { COMPARE_PAGES } = await import("../data/compare");
    const { LANDING_HIRE_BOTS } = await import("./bot-marketplace");
    const { SITEMAP_HUB_PATHS } = await import("./sitemap");
    const paths = sitemapEntries().map((entry) => entry.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/integrations");
    expect(paths).toContain("/use-cases");
    expect(paths).toContain("/templates");
    expect(paths).toContain("/pricing");
    expect(paths).toContain("/enterprise");
    expect(paths).toContain("/changelog");
    expect(paths).toContain("/download");
    expect(paths).toContain("/contact");
    expect(paths).toContain("/privacy");
    expect(paths).toContain("/terms");
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
    expect(paths).toContain("/use-cases/content-creation");
    expect(paths).toContain("/templates/chief-of-staff");
    expect(
      paths.some((path) => path.startsWith("/integrations/category/")),
    ).toBe(true);
    expect(paths).toContain("/llms.txt");
    expect(paths).toContain("/mcp");
    expect(paths.some((path) => path.startsWith("/s/"))).toBe(false);
    expect(paths.length).toBe(
      SITEMAP_HUB_PATHS.length +
        DISCOVERY_SITEMAP_PATHS.length +
        integrationCategories().length +
        INTEGRATIONS.length +
        USE_CASES.length +
        LANDING_HIRE_BOTS.length +
        COMPARE_PAGES.length,
    );
  });

  it("emits xml with canonical landing urls", () => {
    const xml = sitemapXml();
    expect(xml).toContain(canonicalUrl("/integrations/postiz"));
    expect(xml).toContain(
      canonicalUrl("/compare/grok-bot-vs-hermes-vs-openclaw-vs-paperclip"),
    );
    expect(xml).toContain(canonicalUrl("/compare/grok-bot-vs-hermes"));
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("xmlns:image=");
    expect(xml).toContain(canonicalUrl("/og.png"));
  });
});

describe("compare pages", () => {
  it("ships the four-way page plus every pairwise vs", async () => {
    const { COMPARE_PAGES, FEATURE_ROWS, getComparePage } = await import(
      "../data/compare"
    );
    const page = getComparePage("grok-bot-vs-hermes-vs-openclaw-vs-paperclip");
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
    expect(
      FEATURE_ROWS.find((row) => row.label === "Multiplayer")?.values.groxbot,
    ).toBe(true);
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
  it("names Whip Computer and points agents at MCP plus use cases", () => {
    const txt = landingLlmsTxt();
    expect(txt.startsWith("# Whip Computer\n")).toBe(true);
    expect(txt).toContain("/mcp");
    expect(txt).toContain("/identity.json");
    expect(txt).toContain("/use-cases/");
    expect(txt).toContain("/templates/");
    expect(txt).toContain("/pricing");
    expect(txt).toContain("/compare/");
    expect(txt).toContain("/press");
    expect(txt).toContain("/og.png");
  });

  it("leads public copy with AI is better together", () => {
    expect(TAGLINE).toBe("AI is better together");
    expect(HERO_PITCH).toBe("Multiplayer. Open source. Invite only.");
    expect(DEFAULT_TITLE).toBe("Multiplayer. Open source. Invite only. | Whip Computer");
    expect(DEFAULT_DESCRIPTION).toMatch(/^Multiplayer\. Open source\. Invite only\./);
    expect(FOOTER_BLURB).toMatch(/whipping the computer together/);
    expect(landingLlmsTxt()).toContain("AI is better together");
  });

  it("points the homepage at the compare pages", async () => {
    const { COMPARE, COMPARE_LINKS, COMPARE_CALLOUT } = await import("./copy");
    expect(COMPARE.map((item) => item.name)).toEqual([
      "OpenClaw / Hermes",
      "Paperclip",
      "Grok Bot",
      "Whip Computer",
    ]);
    expect(COMPARE.some((item) => item.ours)).toBe(true);
    expect(COMPARE_CALLOUT.title).toMatch(/Hermes.*OpenClaw.*Paperclip/i);
    expect(COMPARE_LINKS.map((link) => link.slug)).toEqual([
      "grok-bot-vs-hermes-vs-openclaw-vs-paperclip",
      "grok-bot-vs-hermes",
      "grok-bot-vs-openclaw",
      "grok-bot-vs-paperclip",
    ]);
  });

  it("opens the homepage with a category headline and a demo slot", () => {
    expect(HERO_HEADLINE).toBe("AI for teams.");
    expect(TALK_HEADLINE).toBe(
      "Invite your team to talk with your AI agents.",
    );
    expect(TALK_POINTS.map((item) => item.text)).toEqual([
      "Experts build the agent",
      "The team uses it",
      "The company gets more done",
    ]);
    expect(TALK_LEDE).toMatch(/Experts build the agent/);
    expect(ADOPT_HEADLINE).toBe("Track your team's AI adoption.");
    expect(ADOPT_POINTS.map((item) => item.text)).toEqual([
      "See who put work in motion",
      "A contributions heatmap",
      "Not a spend cockpit",
    ]);
    expect(KNOW_HEADLINE).toBe("A knowledge base that improves itself.");
    expect(KNOW_POINTS.map((item) => item.text)).toEqual([
      "Chat is automatically organized onto the knowledge base",
      "It updates itself as you work",
      "The whole team shares one",
    ]);
    expect(MEET_HEADLINE).toBe("Meet your team where they work.");
    expect(MEET_CHANNELS.map((item) => item.name)).toEqual([
      "Slack",
      "Discord",
      "Microsoft Teams",
    ]);
    expect(PHONE_HEADLINE).toBe("No Mac Mini is required.");
    expect(PHONE_LEDE).toMatch(/phone even when your laptop is shut down/);
    const landing = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../components/Landing.tsx",
      ),
      "utf8",
    );
    expect(HOW_HEADLINE).toBe("Hire. Invite. See who started.");
    expect(HIRE_BEAT_HEADLINE).toBe("Hire a bot.");
    expect(INVITE_HEADLINE).toBe("Invite your team to use the bot.");
    expect(RUNS_HEADLINE).toBe("Runs everywhere.");
    expect(landing.indexOf('id="hire-bot"')).toBeLessThan(
      landing.indexOf('id="invite"'),
    );
    expect(landing.indexOf('id="invite"')).toBeLessThan(
      landing.indexOf('id="adopt"'),
    );
    expect(landing.indexOf('id="adopt"')).toBeLessThan(
      landing.indexOf('id="everywhere"'),
    );
    expect(landing.indexOf('id="everywhere"')).toBeLessThan(
      landing.indexOf('id="phone"'),
    );
    expect(landing.indexOf('id="phone"')).toBeLessThan(
      landing.indexOf('id="knowledge"'),
    );
    expect(landing.indexOf('id="knowledge"')).toBeLessThan(
      landing.indexOf('id="models"'),
    );
    expect(landing.indexOf('id="models"')).toBeLessThan(
      landing.indexOf('id="routines"'),
    );
    expect(landing.indexOf('id="routines"')).toBeLessThan(
      landing.indexOf('id="hire-catalog"'),
    );
    expect(landing).toContain("PHONE_HEADLINE");
    expect(landing).toContain("<HandoffScene />");
    expect(landing).toContain("<HomeHireStrip");
    expect(landing).toContain("<RoutineLine");
    expect(landing).not.toContain("HomeJobStrip");
    expect(landing).not.toContain("HomeJobMarquee");
    expect(landing).not.toContain("homeJobMarquee");
    expect(landing).not.toContain('id="use-cases"');
    expect(landing).not.toContain('id="meet"');
    expect(landing).not.toContain('id="apps"');
    expect(landing).not.toContain("<DemoShowcase");
    expect(landing).not.toContain('className="statement"');
    expect(landing).not.toContain("A computer you can ignore");
    expect(landing).not.toContain("className=\"tiles\"");
    expect(JOBS_HEADLINE).toBe("A Bot. Your tools. The job.");
    expect(APPS_HEADLINE).toBe("Connect the bot to any apps.");
    expect(APPS_LEDE).toBe(`${formatIntegrationCount()} integrations.`);
    expect(APPS_LEDE).not.toMatch(/composio/i);
    expect(APPS_TOOLS.map((item) => item.name)).toEqual([
      "Instagram",
      "Gmail",
      "LinkedIn",
      "Notion",
      "Google Drive",
      "GitHub",
    ]);
    expect(HERO_COMPARE_NAMES).toEqual(["Hermes Agent", "OpenClaw", "Grok Bot"]);
    expect(HERO_LEDE).toMatch(/but for teams/);
    expect(HERO_PLATFORMS_LINE).toBe(
      "Available for Web, Mac, iOS, Android, Discord, Slack, Microsoft Teams",
    );
    expect(HERO_DEMO.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/);
    expect(TALK_DEMO.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/);
    expect(TALK_DEMO.youtubeId).not.toBe(HERO_DEMO.youtubeId);
    expect(STORY.map((item) => item.id)).toEqual(["hire", "invite", "adopt"]);
    expect(FAQS).toHaveLength(5);
    expect(FAQS.map((item) => item.q)).toEqual([
      "How is this different from OpenClaw or Hermes?",
      "Do I need a workflow builder?",
      "Is it open source?",
      "Which models can I use?",
      "Does my data leave Whip Computer?",
    ]);
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
      "Track your team's AI adoption.",
      "The company’s knowledge base should evolve from group chats.",
      "No Mac Mini is required.",
    ]);
    expect(THESES[2]?.lede).toMatch(
      /automatically organized onto the knowledge base/,
    );
    expect(THESES[3]?.lede).toMatch(/phone even when your laptop is shut down/);
    expect(THESES[3]?.why).toMatch(/anytime, anywhere/);
    expect(THESES[3]?.why).toMatch(/good decisions and good ideas/);
  });
});

describe("open graph", () => {
  it("emits a 1200x630 PNG share card on every public page", () => {
    const head = seoHead({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      path: "/",
    });
    const image = head.meta.find((item) => item.property === "og:image");
    expect(image?.content).toBe(canonicalUrl("/og.png"));
    expect(
      head.meta.find((item) => item.property === "og:image:width")?.content,
    ).toBe("1200");
    expect(
      head.meta.find((item) => item.property === "og:image:height")?.content,
    ).toBe("630");
    expect(
      head.meta.find((item) => item.name === "twitter:card")?.content,
    ).toBe("summary_large_image");
    expect(
      head.meta.find((item) => item.name === "twitter:image")?.content,
    ).toBe(canonicalUrl("/og.png"));
    expect(head.links.some((item) => item.rel === "icon")).toBe(true);
    expect(
      head.links.some(
        (item) => item.rel === "icon" && item.href === "/favicon.ico",
      ),
    ).toBe(true);
    expect(
      head.links.some(
        (item) => item.rel === "icon" && item.href === "/favicon.svg",
      ),
    ).toBe(true);
    expect(head.links.some((item) => item.rel === "apple-touch-icon")).toBe(
      true,
    );
  });

  it("keeps shared notes out of the index", () => {
    const head = seoHead({
      title: "Notes",
      description: "A shared note.",
      path: "/s/abc",
      robots: "noindex, nofollow",
    });
    expect(head.meta.find((item) => item.name === "robots")?.content).toBe(
      "noindex, nofollow",
    );
    expect(head.links.some((item) => item.rel === "describedby")).toBe(false);
    expect(
      head.meta.find((item) => item.property === "og:image")?.content,
    ).toBe(canonicalUrl("/og.png"));
  });
});

describe("MCP well-known discovery", () => {
  const here = dirname(fileURLToPath(import.meta.url));

  it("serves the server card for /.well-known/mcp.json", async () => {
    const res = discoveryResponse("/.well-known/mcp.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.text()).toContain("streamable-http");
  });

  it("registers well-known MCP routes in the generated route tree", () => {
    const tree = readFileSync(join(here, "../routeTree.gen.ts"), "utf8");
    expect(tree).toContain("/.well-known/mcp.json");
    expect(tree).toContain("/.well-known/mcp'");
    expect(tree).toContain("/.well-known/mcp/server-card.json");
    expect(tree).toContain("/.well-known/api-catalog");
    expect(tree).not.toContain("routes/.well-known/");
  });
});
