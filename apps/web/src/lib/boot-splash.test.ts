import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(root, "../styles.css"), "utf8");
const indexHtml = readFileSync(join(root, "../../index.html"), "utf8");
const route = readFileSync(join(root, "../routes/__root.tsx"), "utf8");
const style = indexHtml.slice(
  indexHtml.indexOf("<style>"),
  indexHtml.indexOf("</style>"),
);

describe("boot splash", () => {
  it("paints the real teammate marks, centered, before React mounts", () => {
    expect(style).toMatch(/\.boot-splash\s*\{[^}]*position:\s*fixed/s);
    expect(style).toMatch(/\.boot-splash\s*\{[^}]*inset:\s*0/s);
    expect(style).not.toMatch(/\.boot-splash\s*\{[^}]*min-height:\s*100%/s);
    expect(style).not.toContain("boot-enter");
    expect(indexHtml).toContain("<svg");
    expect(indexHtml).toContain("<title>Ada</title>");
    expect(indexHtml).toContain("<title>Sam</title>");
    expect(indexHtml).toContain("<title>Kai</title>");
    expect(indexHtml).toContain("#e45c9a");
    expect(indexHtml).toContain("#5b7cff");
    expect(indexHtml).toContain("#2f9e6d");
    expect(indexHtml).not.toContain("boot-enter");
    expect(indexHtml).not.toMatch(/class="boot-face"><\/span>/);
  });

  it("shows the pending splash immediately and never min-delays the office", () => {
    expect(route).toContain("pendingComponent: BootSplash");
    expect(route).toMatch(/pendingMs:\s*0/);
    expect(route).toMatch(/pendingMinMs:\s*0/);
    expect(route).not.toContain("pendingMs: 1000");
    expect(route).not.toContain('<p className="kicker">Groxbot</p>');
  });

  it("keeps the hydrated splash pinned to the viewport too", () => {
    expect(css).toMatch(/\.boot-splash\s*\{[^}]*position:\s*fixed/s);
    expect(css).toMatch(/\.boot-splash\s*\{[^}]*inset:\s*0/s);
    expect(css).toMatch(/\.boot-splash-embed\s*\{[^}]*position:\s*relative/s);
    expect(css).not.toContain("boot-enter");
    expect(css).not.toContain("@keyframes boot-settle");
  });
});
