import { bytesToBase64 } from "./computer-attachment";

const SIZE = 256;
const JPEG_QUALITY = 0.88;

export async function encodeProfileImage(
  file: File,
): Promise<{ content: string; mediaType: "image/jpeg" }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a photo.");
  }
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.max(0, (bitmap.width - side) / 2);
  const sy = Math.max(0, (bitmap.height - side) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not read that photo.");
  }
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => {
        if (next) resolve(next);
        else reject(new Error("Could not save that photo."));
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { content: bytesToBase64(bytes), mediaType: "image/jpeg" };
}
