/**
 * X's card image pipeline drops RGBA PNGs (color type 6), even when every
 * pixel is opaque and Twitterbot fetches 200. Flatten to truecolor RGB.
 */
import { crc32, deflateSync, inflateSync } from "node:zlib";

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function pngColorType(png: Buffer): number {
  if (!png.subarray(0, 8).equals(PNG_SIG)) {
    throw new Error("not a PNG");
  }
  return png[25] ?? -1;
}

export function flattenPngToRgb(png: Buffer): Buffer {
  const chunks = readChunks(png);
  const ihdr = chunks.find((chunk) => chunk.type === "IHDR")?.data;
  if (!ihdr || ihdr.length < 13) {
    throw new Error("PNG missing IHDR");
  }
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const interlace = ihdr[12];
  if (bitDepth !== 8 || interlace !== 0) {
    throw new Error(
      `unsupported PNG (bitDepth=${bitDepth} interlace=${interlace})`,
    );
  }
  if (colorType === 2) return png;
  if (colorType !== 6) {
    throw new Error(`unsupported PNG color type ${colorType}`);
  }
  const compressed = Buffer.concat(
    chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data),
  );
  const rgba = unfilter(width, height, 4, inflateSync(compressed));
  const rgb = Buffer.alloc(height * (1 + width * 3));
  let out = 0;
  for (let y = 0; y < height; y++) {
    rgb[out++] = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = (rgba[i + 3] ?? 0) / 255;
      rgb[out++] = Math.round((rgba[i] ?? 0) * alpha);
      rgb[out++] = Math.round((rgba[i + 1] ?? 0) * alpha);
      rgb[out++] = Math.round((rgba[i + 2] ?? 0) * alpha);
    }
  }
  const newIhdr = Buffer.from(ihdr);
  newIhdr[9] = 2;
  return Buffer.concat([
    PNG_SIG,
    pngChunk("IHDR", newIhdr),
    pngChunk("IDAT", deflateSync(rgb, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Test helper: 8-bit RGBA, filter-none scanlines. */
export function encodeRgbaPng(
  width: number,
  height: number,
  rgba: Buffer,
): Buffer {
  if (rgba.length !== width * height * 4) {
    throw new Error("RGBA buffer length");
  }
  const raw = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0;
    rgba.copy(raw, offset, y * width * 4, (y + 1) * width * 4);
    offset += width * 4;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    PNG_SIG,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function readChunks(png: Buffer): Array<{ type: string; data: Buffer }> {
  if (!png.subarray(0, 8).equals(PNG_SIG)) {
    throw new Error("not a PNG");
  }
  const chunks: Array<{ type: string; data: Buffer }> = [];
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([header, body, crc]);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilter(
  width: number,
  height: number,
  bpp: number,
  data: Buffer,
): Buffer {
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let src = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = data[src++];
    const recon = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const raw = data[src++] ?? 0;
      const left = i >= bpp ? (recon[i - bpp] ?? 0) : 0;
      const up = prev[i] ?? 0;
      const upLeft = i >= bpp ? (prev[i - bpp] ?? 0) : 0;
      let value: number;
      switch (filter) {
        case 0:
          value = raw;
          break;
        case 1:
          value = raw + left;
          break;
        case 2:
          value = raw + up;
          break;
        case 3:
          value = raw + Math.floor((left + up) / 2);
          break;
        case 4:
          value = raw + paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`bad PNG filter ${filter}`);
      }
      recon[i] = value & 255;
    }
    recon.copy(out, y * stride);
    prev = recon;
  }
  return out;
}
