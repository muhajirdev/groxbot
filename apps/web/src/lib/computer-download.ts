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

export function computerDownloadBlob(file: ComputerDownload): Blob {
  const bytes = decodeDownloadBytes(file.content);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const buffer = copy.buffer.slice(
    copy.byteOffset,
    copy.byteOffset + copy.byteLength,
  );
  return new Blob([buffer], {
    type: file.mediaType || "application/octet-stream",
  });
}

export function saveComputerDownload(file: ComputerDownload): void {
  const blob = computerDownloadBlob(file);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename || computerDownloadFilename(file.path);
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
