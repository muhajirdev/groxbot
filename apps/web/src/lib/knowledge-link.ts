const MAX_KNOWLEDGE_LINK = 240;

export type KnowledgeHref =
  | { kind: "external"; href: string }
  | { kind: "path"; path: string }
  | { kind: "invalid" };

export type KnowledgeLinkTarget = "file" | "folder";

/** Office-root path, or http(s)/mailto. No ../, no wiki links. */
export function parseKnowledgeHref(raw: string): KnowledgeHref {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "invalid" };
  if (/^https?:\/\//iu.test(trimmed) || /^mailto:/iu.test(trimmed)) {
    return { kind: "external", href: trimmed };
  }
  if (/^[a-z][a-z0-9+.-]*:/iu.test(trimmed)) return { kind: "invalid" };

  const pathPart = trimmed.split(/[?#]/u, 1)[0] ?? "";
  const normalized = pathPart.replaceAll("\\", "/").replace(/^\/+/u, "");
  if (!normalized || normalized === ".") return { kind: "invalid" };
  const parts: string[] = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part === ".." || part.includes("\0") || /[\[\]]/u.test(part)) {
      return { kind: "invalid" };
    }
    parts.push(part);
  }
  const path = parts.join("/");
  if (!path || path.length > MAX_KNOWLEDGE_LINK) return { kind: "invalid" };
  return { kind: "path", path };
}

export function knowledgeMarkdownUrl(url: string): string | null {
  const parsed = parseKnowledgeHref(url);
  if (parsed.kind === "external") return parsed.href;
  if (parsed.kind === "path") return `/${parsed.path}`;
  return null;
}

/** rehype-harden only treats `/…` `./…` `../…` as relative. Prefix office paths. */
export function rewriteKnowledgeHrefs() {
  return (tree: { children?: unknown[] }) => {
    visitHref(tree);
  };
}

function visitHref(node: {
  tagName?: string;
  properties?: { href?: unknown };
  children?: unknown[];
}) {
  if (node.tagName === "a" && typeof node.properties?.href === "string") {
    const parsed = parseKnowledgeHref(node.properties.href);
    if (parsed.kind === "path") node.properties.href = `/${parsed.path}`;
  }
  for (const child of node.children ?? []) {
    if (child && typeof child === "object") visitHref(child);
  }
}

export function knowledgeLinkTarget(
  path: string,
  files: Iterable<string>,
): KnowledgeLinkTarget | null {
  const prefix = `${path}/`;
  for (const file of files) {
    if (file === path) return "file";
    if (file.startsWith(prefix)) return "folder";
  }
  return null;
}
