import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GROXBOT_OG_HEIGHT,
  GROXBOT_OG_WIDTH,
  PRESS_ASSETS,
} from "@groxbot/seo";
import { describe, expect, it } from "vitest";
import {
  lookupPressAsset,
  ogCardSvg,
  PRESS_ASSET_VERSION,
  pressAssetFiles,
  pressAssetHref,
} from "./press-assets";

function pngSize(buf: Buffer): { width: number; height: number } {
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

describe("press assets", () => {
  it("serves an SVG for every listed logo", () => {
    expect(pressAssetFiles()).toEqual(PRESS_ASSETS.map((asset) => asset.file));
    for (const asset of PRESS_ASSETS) {
      const file = lookupPressAsset(asset.file);
      expect(file, asset.file).toBeDefined();
      expect(file?.contentType).toContain("image/svg+xml");
      expect(file?.body).toContain("<svg");
      expect(file?.body).toContain("Groxbot");
      expect(file?.body).toContain("<rect");
      expect(file?.body).not.toContain("pupil");
    }
  });

  it("draws a 1200x630 Open Graph card", () => {
    const svg = ogCardSvg();
    expect(svg).toContain(`width="${GROXBOT_OG_WIDTH}"`);
    expect(svg).toContain(`height="${GROXBOT_OG_HEIGHT}"`);
    expect(svg).toContain("AI is better together");
    expect(svg).toContain("#e45c9a");
    expect(lookupPressAsset("groxbot-og.svg")?.body).toBe(svg);
  });

  it("ships crawler PNGs next to the marketing public files", () => {
    const publicDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../public",
    );
    const og = pngSize(readFileSync(join(publicDir, "og.png")));
    expect(og).toEqual({ width: 1200, height: 630 });
    const icon = pngSize(readFileSync(join(publicDir, "icon.png")));
    expect(icon).toEqual({ width: 512, height: 512 });
    const apple = pngSize(
      readFileSync(join(publicDir, "apple-touch-icon.png")),
    );
    expect(apple).toEqual({ width: 180, height: 180 });
    const ico = readFileSync(join(publicDir, "favicon.ico"));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    expect(existsSync(join(publicDir, "favicon.svg"))).toBe(true);
    expect(readFileSync(join(publicDir, "favicon.svg"), "utf8")).toContain(
      "<svg",
    );
  });

  it("does not invent extra files", () => {
    expect(lookupPressAsset("logo.png")).toBeUndefined();
  });

  it("cache-busts download hrefs when the mark changes", () => {
    expect(pressAssetHref("groxbot-mark.svg")).toBe(
      `/press/groxbot-mark.svg?v=${PRESS_ASSET_VERSION}`,
    );
  });
});
