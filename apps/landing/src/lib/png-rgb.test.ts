import { describe, expect, it } from "vitest";
import { encodeRgbaPng, flattenPngToRgb, pngColorType } from "./png-rgb";

describe("flattenPngToRgb", () => {
  it("strips the alpha channel so X can render the card", () => {
    const rgba = Buffer.from([255, 0, 0, 255, 0, 255, 0, 128]);
    const png = encodeRgbaPng(2, 1, rgba);
    expect(pngColorType(png)).toBe(6);
    const rgb = flattenPngToRgb(png);
    expect(pngColorType(rgb)).toBe(2);
    expect(rgb.readUInt32BE(16)).toBe(2);
    expect(rgb.readUInt32BE(20)).toBe(1);
    const again = flattenPngToRgb(rgb);
    expect(again).toBe(rgb);
  });

  it("composites translucent pixels onto black", () => {
    const rgba = Buffer.from([255, 0, 0, 128]);
    const rgb = flattenPngToRgb(encodeRgbaPng(1, 1, rgba));
    expect(pngColorType(rgb)).toBe(2);
    expect(rgb.readUInt32BE(16)).toBe(1);
    expect(rgb.readUInt32BE(20)).toBe(1);
  });
});
