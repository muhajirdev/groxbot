/**
 * Rasterize brand SVGs to PNG for crawlers that reject SVG (og:image).
 *
 *   pnpm --filter @groxbot/landing generate:og
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { iconTileSvg, ogCardSvg } from "../src/lib/press-assets.ts";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(ROOT, "../public");
const FONT_URL =
  "https://github.com/adobe-fonts/source-sans/raw/release/TTF/SourceSans3-Semibold.ttf";

type Target = {
  file: string;
  svg: string;
  width: number;
};

async function loadFontFile(): Promise<string> {
  const res = await fetch(FONT_URL);
  if (!res.ok) {
    throw new Error(`Font fetch failed: ${res.status} ${res.statusText}`);
  }
  const dir = mkdtempSync(join(tmpdir(), "groxbot-og-"));
  const path = join(dir, "SourceSans3-Semibold.ttf");
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

function renderPng(svg: string, width: number, fontFile: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: {
      fontFiles: [fontFile],
      defaultFontFamily: "Source Sans 3",
      loadSystemFonts: false,
    },
    background: "transparent",
  });
  return Buffer.from(resvg.render().asPng());
}

async function main(): Promise<void> {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  const fontFile = await loadFontFile();
  const targets: Target[] = [
    { file: "og.png", svg: ogCardSvg(), width: 1200 },
    { file: "apple-touch-icon.png", svg: iconTileSvg("#000000"), width: 180 },
    { file: "icon.png", svg: iconTileSvg("#000000"), width: 512 },
  ];
  for (const target of targets) {
    const png = renderPng(target.svg, target.width, fontFile);
    const out = join(PUBLIC_DIR, target.file);
    writeFileSync(out, png);
    console.log(`wrote ${out} (${png.byteLength} bytes)`);
  }
}

await main();
