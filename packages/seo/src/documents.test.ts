import { CLOUD_LANDING_ORIGIN } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  aiJson,
  brandTxt,
  developerAiTxt,
  faqAiTxt,
  identityJson,
  llmsFullTxt,
  llmsTxt,
  robotsTxt,
  sitemapXml,
} from "./documents.js";
import {
  cloudOrigins,
  GROXBOT_STACK,
  GROXBOT_SUMMARY,
  GROXBOT_TAGLINE,
  originsFromWeb,
} from "./identity.js";

const origins = cloudOrigins();

describe("discovery documents", () => {
  it("uses Groxbot as the llms.txt H1 and names identity.json the same", () => {
    expect(cloudOrigins().web).toBe(CLOUD_LANDING_ORIGIN);
    const txt = llmsTxt(origins);
    expect(txt.startsWith("# Groxbot\n")).toBe(true);
    expect(txt).toContain("hello@groxbot.com");
    expect(txt).toContain(`](${CLOUD_LANDING_ORIGIN}/llms.txt)`);
    expect(txt).toContain("/press");
    expect(txt).toContain("/og.png");
    expect(identityJson(origins).name).toBe("Groxbot");
    expect(identityJson(origins).logo).toBe(`${CLOUD_LANDING_ORIGIN}/icon.png`);
    expect(identityJson(origins).image).toBe(`${CLOUD_LANDING_ORIGIN}/og.png`);
    expect(aiJson(origins).name).toBe("Groxbot");
    const pages = identityJson(origins).sitePages as Array<{ name: string }>;
    expect(pages.some((page) => page.name === "Press kit")).toBe(true);
    expect(pages.some((page) => page.name === "Compare")).toBe(true);
  });

  it("lists public pages in the sitemap and allows AI crawlers", () => {
    const sitemap = sitemapXml(origins);
    expect(sitemap).toContain(`${CLOUD_LANDING_ORIGIN}/llms.txt`);
    expect(sitemap).toContain(`${CLOUD_LANDING_ORIGIN}/mcp`);
    expect(sitemap).toContain(`${CLOUD_LANDING_ORIGIN}/press`);
    expect(sitemap).toContain(`${CLOUD_LANDING_ORIGIN}/compare`);
    expect(sitemap).toContain(
      `${CLOUD_LANDING_ORIGIN}/compare/grok-bot-vs-hermes-vs-openclaw-vs-paperclip`,
    );
    expect(sitemap).toContain(
      `${CLOUD_LANDING_ORIGIN}/compare/grok-bot-vs-hermes`,
    );
    expect(sitemap).toContain(
      `${CLOUD_LANDING_ORIGIN}/compare/grok-bot-vs-openclaw`,
    );
    expect(robotsTxt(origins)).toContain("User-agent: GPTBot");
    expect(robotsTxt(origins)).toContain("Allow: /llms.txt");
    expect(robotsTxt(origins)).toContain("Allow: /og.png");
    expect(robotsTxt(origins)).toContain("Allow: /favicon.ico");
    expect(robotsTxt(origins)).toContain("Allow: /favicon.svg");
    expect(robotsTxt(origins)).toContain("Allow: /compare");
    expect(robotsTxt(origins)).toContain("Disallow: /s/");
    expect(robotsTxt(origins)).not.toContain("/s/\nAllow");
  });

  it("answers Paperclip and Hermes in faq-ai", () => {
    const faq = faqAiTxt(origins);
    expect(faq).toMatch(/How is Groxbot different from Paperclip/i);
    expect(faq).toMatch(/How is Groxbot different from Hermes/i);
    expect(faq).toContain(
      "/compare/grok-bot-vs-hermes-vs-openclaw-vs-paperclip",
    );
  });

  it("describes Cloudflare Workers and self-host later, not Rivet", () => {
    expect(llmsTxt(origins)).toMatch(/self-host/i);
    expect(llmsTxt(origins)).toMatch(/Cloudflare Workers/i);
    expect(developerAiTxt(origins)).toMatch(/wrangler/);
    expect(faqAiTxt(origins)).toMatch(/self-host/i);
    expect(llmsFullTxt(origins)).not.toMatch(/Rivet/i);
    expect(GROXBOT_STACK.join("\n")).not.toMatch(/Rivet/i);
    expect(GROXBOT_STACK.join("\n")).toMatch(/Pi/);
    expect(GROXBOT_STACK.join("\n")).toMatch(/AppRuntime/);
  });

  it("maps workers.dev staging hosts to the hosted API", () => {
    const staging = originsFromWeb("https://groxbot-web.qalam.workers.dev");
    expect(staging.api).toBe("https://groxbot-api.qalam.workers.dev");
    expect(staging.web).toBe("https://groxbot-landing.qalam.workers.dev");
    expect(staging.office).toBe("https://groxbot-web.qalam.workers.dev");
  });

  it("does not claim zero retention as a Groxbot product feature", () => {
    const faq = faqAiTxt(origins);
    expect(faq).toMatch(/Does my data leave the office/i);
    expect(faq).toMatch(/does not claim zero retention/i);
    expect(faq).toMatch(/office is meant to remember/i);
    expect(faq).toContain("hello@groxbot.com");
  });

  it("sells a computer as built into the bot, not a separate desk", () => {
    expect(GROXBOT_SUMMARY).toMatch(/real computer/i);
    expect(GROXBOT_SUMMARY).toMatch(/AI is better together/);
    expect(GROXBOT_STACK.join("\n")).toMatch(/Cloudflare Computer workspace/i);
    const faq = faqAiTxt(origins);
    expect(faq).toMatch(/What is a computer/i);
    expect(faq).toMatch(/not a second Durable Object/i);
    expect(faq).not.toMatch(/There is no Computer product/);
    expect(llmsTxt(origins)).toMatch(/Each bot has a computer/i);
  });

  it("uses AI is better together as the product tagline", () => {
    expect(GROXBOT_TAGLINE).toBe("AI is better together");
    expect(llmsTxt(origins)).toContain(GROXBOT_TAGLINE);
    expect(brandTxt(origins)).toContain(`## Tagline\n\n${GROXBOT_TAGLINE}`);
    expect(faqAiTxt(origins)).toContain(GROXBOT_TAGLINE);
  });

  it("puts a large-image Open Graph card on HTML discovery pages", async () => {
    const { llmsHtml, jsonLd } = await import("./documents.js");
    const html = llmsHtml(origins);
    expect(html).toContain('property="og:image"');
    expect(html).toContain(`${CLOUD_LANDING_ORIGIN}/og.png`);
    expect(html).toContain(`${CLOUD_LANDING_ORIGIN}/favicon.ico`);
    expect(html).toContain(`${CLOUD_LANDING_ORIGIN}/favicon.svg`);
    expect(html).toContain('content="summary_large_image"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    const graph = jsonLd(origins)["@graph"] as Array<Record<string, unknown>>;
    expect(graph[0]?.logo).toMatchObject({
      url: `${CLOUD_LANDING_ORIGIN}/icon.png`,
    });
    expect(graph[1]?.image).toBe(`${CLOUD_LANDING_ORIGIN}/og.png`);
  });
});
