import { type KnowledgeHref, parseKnowledgeHref } from "./knowledge-link";

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

/** Backtick chips like `essay-car.md` — not `const x` or a folder name. */
export function parseComputerFileHint(raw: string): string | null {
  const text = raw.trim();
  if (!text || /\s/.test(text)) return null;
  const parsed = parseChatHref(text);
  if (parsed.kind !== "path") return null;
  const name = parsed.path.split("/").at(-1) ?? "";
  if (!/\.[a-z0-9]{1,8}$/i.test(name) || name.startsWith(".")) return null;
  return parsed.path;
}

export function inlineCodeText(children: unknown): string {
  if (typeof children === "string") return children;
  if (
    Array.isArray(children) &&
    children.length === 1 &&
    typeof children[0] === "string"
  ) {
    return children[0];
  }
  return "";
}
