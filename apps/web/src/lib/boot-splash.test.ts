import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(root, "../styles.css"), "utf8");
const indexHtml = readFileSync(join(root, "../../index.html"), "utf8");
const route = readFileSync(join(root, "../routes/__root.tsx"), "utf8");

describe("boot splash", () => {
  it("paints a first-paint splash in index.html before React mounts", () => {
    expect(indexHtml).toContain('id="root"');
    expect(indexHtml).toContain('class="boot-splash"');
    expect(indexHtml).toContain('aria-label="Opening Groxbot"');
    expect(indexHtml).toContain("boot-word");
    expect(indexHtml).toMatch(/boot-face[\s\S]*boot-face[\s\S]*boot-face/);
    expect(indexHtml).not.toContain("boot-enter");
  });

  it("shows the pending splash immediately and never min-delays the office", () => {
    expect(route).toContain("pendingComponent: BootSplash");
    expect(route).toMatch(/pendingMs:\s*0/);
    expect(route).toMatch(/pendingMinMs:\s*0/);
    expect(route).not.toContain("pendingMs: 1000");
    expect(route).not.toContain('<p className="kicker">Groxbot</p>');
  });

  it("settles the team cluster quickly and respects reduced motion", () => {
    expect(css).toMatch(/@keyframes boot-settle/);
    expect(css).toMatch(
      /\.boot-enter \.boot-face,\s*\.boot-enter \.boot-word\s*\{[^}]*animation:\s*boot-settle 0\.42s/s,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.boot-enter \.boot-face,[\s\S]*?animation:\s*none/,
    );
  });
});
