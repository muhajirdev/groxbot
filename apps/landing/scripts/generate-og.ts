/**
 * Rasterize brand SVGs to PNG/ICO for crawlers and browsers that reject SVG.
 *
 *   pnpm --filter @groxbot/landing generate:og
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { iconTileSvg, lookupPressAsset, ogCardSvg } from "../src/lib/press-assets.ts";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(ROOT, "../public");
const FONT_URL =
  "https://github.com/adobe-fonts/source-sans/raw/release/TTF/SourceSans3-Semibold.ttf";
const ICO_SIZES = [16, 32, 48] as const;

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

/** PNG-in-ICO. Chrome, Safari, Edge, and Firefox all accept this. */
function packPngIco(pngs: Buffer[]): Buffer {
  const headerSize = 6 + 16 * pngs.length;
  let offset = headerSize;
  const entries = pngs.map((data) => {
    const width = data.readUInt32BE(16);
    const height = data.readUInt32BE(20);
    const entry = { width, height, bytes: data.byteLength, offset, data };
    offset += data.byteLength;
    return entry;
  });
  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(pngs.length, 4);
  let cursor = 6;
  for (const entry of entries) {
    out.writeUInt8(entry.width >= 256 ? 0 : entry.width, cursor);
    out.writeUInt8(entry.height >= 256 ? 0 : entry.height, cursor + 1);
    out.writeUInt8(0, cursor + 2);
    out.writeUInt8(0, cursor + 3);
    out.writeUInt16LE(1, cursor + 4);
    out.writeUInt16LE(32, cursor + 6);
    out.writeUInt32LE(entry.bytes, cursor + 8);
    out.writeUInt32LE(entry.offset, cursor + 12);
    cursor += 16;
  }
  for (const entry of entries) {
    entry.data.copy(out, entry.offset);
  }
  return out;
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

  const tile = iconTileSvg("#000000");
  const icoPngs = ICO_SIZES.map((size) => renderPng(tile, size, fontFile));
  const ico = packPngIco(icoPngs);
  const icoPath = join(PUBLIC_DIR, "favicon.ico");
  writeFileSync(icoPath, ico);
  console.log(`wrote ${icoPath} (${ico.byteLength} bytes)`);

  const mark = lookupPressAsset("groxbot-mark.svg");
  if (!mark) {
    throw new Error("missing groxbot-mark.svg");
  }
  const svgPath = join(PUBLIC_DIR, "favicon.svg");
  writeFileSync(svgPath, mark.body);
  console.log(`wrote ${svgPath} (${Buffer.byteLength(mark.body)} bytes)`);
}

await main();
