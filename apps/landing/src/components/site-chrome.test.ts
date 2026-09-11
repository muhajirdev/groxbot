import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(root, "../styles.css"), "utf8");
const chrome = readFileSync(join(root, "./SiteChrome.tsx"), "utf8");

describe("SiteHeader", () => {
  it("hides crowded top links before they wrap over the brand", () => {
    expect(chrome).toContain('className="nav-hide-sm"');
    expect(chrome).toContain('className="nav-hide-xs"');
    expect(chrome).toContain("to=\"/pricing\"");
    expect(chrome).toContain("GitHub");
  });
});

describe("landing nav chrome", () => {
  it("keeps the sticky top bar opaque so page chrome cannot show through", () => {
    expect(css).toMatch(/html\s*\{[^}]*scroll-padding-top:\s*72px/s);
    expect(css).toMatch(
      /\.nav\s*\{[^}]*flex-wrap:\s*nowrap[^}]*background:\s*var\(--bg\)/s,
    );
    expect(css).not.toMatch(
      /\.nav\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--bg\) 88%/s,
    );
    expect(css).toMatch(/\.nav-hide-xs\s*\{[^}]*display:\s*none/s);
  });
});
