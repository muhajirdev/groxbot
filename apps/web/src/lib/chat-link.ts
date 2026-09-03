import { parseKnowledgeHref, type KnowledgeHref } from "./knowledge-link";

/**
 * Chat markdown hrefs: office-root / computer paths, or http(s)/mailto.
 * Same-origin URLs with a filename (e.g. localhost/expandra/note.md) are
 * paths — not pages — so they must not navigate the office SPA.
 */
export function parseChatHref(raw: string, origin = ""): KnowledgeHref {
  const parsed = parseKnowledgeHref(raw);
  if (parsed.kind !== "external") return parsed;
  if (!origin || parsed.href.toLowerCase().startsWith("mailto:")) return parsed;
  try {
    const url = new URL(parsed.href);
    if (url.origin !== origin) return parsed;
    const fromPath = parseKnowledgeHref(decodeURIComponent(url.pathname));
    if (fromPath.kind !== "path") return parsed;
    const name = fromPath.path.split("/").at(-1) ?? "";
    if (!name.includes(".")) return parsed;
    return fromPath;
  } catch {
    return parsed;
  }
}
