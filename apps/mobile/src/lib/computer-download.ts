import type { ComputerDownload } from "@groxbot/contracts";

export function computerDownloadFilename(path: string): string {
  return path.replaceAll("\\", "/").split("/").pop()?.trim() || "file";
}

export function decodeDownloadBytes(raw: string): Uint8Array {
  const payload = raw.replace(/^data:[^;]*;base64,/iu, "").replace(/\s/g, "");
  if (!payload) return new Uint8Array();
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function downloadDataUri(
  file: Pick<ComputerDownload, "content" | "mediaType">,
): string {
  const payload = file.content.replace(/^data:[^;]*;base64,/iu, "");
  const type = file.mediaType || "application/octet-stream";
  return `data:${type};base64,${payload}`;
}
