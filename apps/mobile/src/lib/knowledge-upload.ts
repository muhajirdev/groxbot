import type { KnowledgeEntry, KnowledgeList } from "@groxbot/contracts";
import { computerPreviewKind } from "./computer-preview";

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
  file: { name: string; size: number; type: string },
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
  const entries = (list?.entries ?? []).filter(
    (row) => row.path !== entry.path,
  );
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
