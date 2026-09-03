import { computerDownloadFilename } from "./computer-download";

export type ComputerFileKind = "pdf" | "image" | "svg" | "md" | "html" | "file";
export type ComputerPreviewKind = "html" | "pdf" | "image" | "text" | "none";
export type ComputerPreviewSource = "read" | "download" | "none";

const TEXT_PREVIEW_EXTS = new Set([
  ".bash",
  ".css",
  ".csv",
  ".env",
  ".js",
  ".json",
  ".jsx",
  ".log",
  ".markdown",
  ".md",
  ".mjs",
  ".py",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

export function computerFileExtension(path: string): string {
  const name = computerDownloadFilename(path);
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index).toLowerCase();
}

export function computerFileKind(name: string): ComputerFileKind {
  const ext = computerFileExtension(name);
  if (ext === ".pdf") return "pdf";
  if (ext === ".svg") return "svg";
  if (ext === ".md" || ext === ".markdown") return "md";
  if (ext === ".html" || ext === ".htm") return "html";
  if (
    ext === ".png" ||
    ext === ".jpg" ||
    ext === ".jpeg" ||
    ext === ".gif" ||
    ext === ".webp"
  ) {
    return "image";
  }
  return "file";
}

export function computerPreviewKind(
  path: string,
  mediaType = "",
): ComputerPreviewKind {
  if (!path.trim()) return "none";
  const media = mediaType.trim().toLowerCase();
  if (media === "text/html" || media === "application/xhtml+xml") return "html";
  if (media === "application/pdf") return "pdf";
  if (media.startsWith("image/")) return "image";
  if (
    media.startsWith("text/") ||
    media === "application/json" ||
    media === "application/xml" ||
    media.endsWith("+json") ||
    media.endsWith("+xml")
  ) {
    return "text";
  }

  const kind = computerFileKind(path);
  if (kind === "html") return "html";
  if (kind === "pdf") return "pdf";
  if (kind === "image" || kind === "svg") return "image";
  if (kind === "md") return "text";

  const ext = computerFileExtension(path);
  if (!ext || TEXT_PREVIEW_EXTS.has(ext)) return "text";
  return "none";
}

export function computerPreviewSource(
  kind: ComputerPreviewKind,
): ComputerPreviewSource {
  if (kind === "none") return "none";
  if (kind === "pdf" || kind === "image") return "download";
  return "read";
}
