import type {
  ComputerDownload,
  KnowledgeEntry,
  KnowledgeFile,
  KnowledgeList,
} from "@groxbot/contracts";
import { bytesToBase64 } from "./computer-attachment";
import { computerPreviewKind, computerPreviewSource } from "./computer-preview";

export function knowledgeUploadPath(folder: string, filename: string): string {
  const base = filename.replaceAll("\\", "/").split("/").pop() ?? "";
  const cleaned = base
    .replace(/[^\w.\- ()[\]]+/gu, "_")
    .replace(/^\.+/u, "")
    .trim()
    .slice(0, 80);
  const name = cleaned || "file";
  const prefix = folder.replace(/\/+$/u, "");
  return prefix ? `${prefix}/${name}` : name;
}

export function optimisticKnowledgeEntry(
  path: string,
  file: Pick<File, "name" | "size" | "type">,
): KnowledgeEntry {
  const name = path.split("/").filter(Boolean).at(-1) ?? file.name;
  const mediaType = file.type || "";
  const kind = computerPreviewKind(path, mediaType);
  return {
    path,
    name,
    title: name,
    description: "",
    size: file.size,
    encoding: kind === "text" || kind === "html" ? "text" : "binary",
    mediaType,
  };
}

export function upsertKnowledgeEntry(
  list: KnowledgeList | undefined,
  entry: KnowledgeEntry,
): KnowledgeList {
  const entries = (list?.entries ?? []).filter((row) => row.path !== entry.path);
  entries.push(entry);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return { entries, truncated: list?.truncated ?? false };
}

export function dropKnowledgeEntry(
  list: KnowledgeList | undefined,
  path: string,
): KnowledgeList {
  return {
    entries: (list?.entries ?? []).filter((row) => row.path !== path),
    truncated: list?.truncated ?? false,
  };
}

export function seedKnowledgePreview(
  path: string,
  file: Pick<File, "name" | "type">,
  bytes: Uint8Array,
): { read?: KnowledgeFile; download?: ComputerDownload } {
  const mediaType = file.type || "";
  const kind = computerPreviewKind(path, mediaType);
  const source = computerPreviewSource(kind);
  const name = path.split("/").filter(Boolean).at(-1) ?? file.name;
  if (source === "read") {
    return {
      read: {
        path,
        title: name,
        description: "",
        content: new TextDecoder().decode(bytes),
        truncated: false,
        encoding: "text",
        mediaType: mediaType || "text/plain",
        backlinks: [],
      },
    };
  }
  if (source === "download") {
    return {
      download: {
        path,
        filename: name,
        content: bytesToBase64(bytes),
        mediaType: mediaType || "application/octet-stream",
      },
    };
  }
  return {};
}
