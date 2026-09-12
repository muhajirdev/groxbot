import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(root, "../styles.css"), "utf8");
const chrome = readFileSync(join(root, "./SiteChrome.tsx"), "utf8");

describe("navScrolled", () => {
  it("locks the capsule after a short scroll", async () => {
    const { navScrolled } = await import("./SiteChrome");
    expect(navScrolled(0)).toBe(false);
    expect(navScrolled(24)).toBe(false);
    expect(navScrolled(25)).toBe(true);
  });
});

describe("SiteHeader", () => {
  it("hides crowded top links before they wrap over the brand", () => {
    expect(chrome).toContain('className="nav-hide-sm"');
    expect(chrome).toContain('className="nav-hide-xs"');
    expect(chrome).toContain("to=\"/pricing\"");
    expect(chrome).toContain("GitHub");
  });
});

describe("landing nav chrome", () => {
  it("sits in the page wash at the top, then goes opaque in the capsule", () => {
    expect(css).toMatch(/html\s*\{[^}]*scroll-padding-top:\s*72px/s);
    expect(css).toMatch(
      /\.nav\s*\{[^}]*flex-wrap:\s*nowrap[^}]*background:\s*transparent/s,
    );
    expect(css).toMatch(/\.nav\.is-scrolled\s*\{[^}]*background:\s*var\(--bg\)/s);
    expect(css).toMatch(/\.nav-hide-xs\s*\{[^}]*display:\s*none/s);
  });
});

describe("homepage section washes", () => {
  it("paints each homepage band a distinct color", () => {
    expect(css).toMatch(/#top > section::before/);
    expect(css).toContain("--band-paper:");
    expect(css).toContain("--band-sand:");
    expect(css).toContain("--band-peach:");
    expect(css).toContain("--band-blush:");
    expect(css).toMatch(/#talk\s*\{[^}]*--wash-bg:\s*var\(--band-peach\)/s);
    expect(css).toMatch(/#apps\s*\{[^}]*--wash-bg:\s*var\(--band-blush\)/s);
    expect(css).toMatch(/\.know\s*\{[^}]*--wash-bg:\s*var\(--band-sand\)/s);
  });
});
