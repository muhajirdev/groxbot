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

/** Skills and tasks live in the office library (`skills/<name>/SKILL.md`). */
export function isOfficeLibraryPath(path: string): boolean {
  return (
    path === "SKILL.md" ||
    path.endsWith("/SKILL.md") ||
    path === "skills" ||
    path.startsWith("skills/") ||
    path === "TASK.md" ||
    path.endsWith("/TASK.md") ||
    path === "tasks" ||
    path.startsWith("tasks/")
  );
}

/**
 * Map a chip, relative markdown href, or folder to the office file.
 * `SKILL.md` and `skills/<name>` become `skills/<name>/SKILL.md` when that
 * file is in the library — not a second store, and not the computer.
 */
export function resolveOfficeLibraryPath(
  path: string,
  files: Iterable<string>,
  from?: string,
): string {
  const fileSet = files instanceof Set ? files : new Set(files);
  if (fileSet.has(path)) return path;

  if (from) {
    const slash = from.lastIndexOf("/");
    const dir = slash === -1 ? "" : from.slice(0, slash);
    const relative = dir ? `${dir}/${path}` : path;
    if (fileSet.has(relative)) return relative;
    if (fileSet.has(`${relative}/SKILL.md`)) return `${relative}/SKILL.md`;
    if (fileSet.has(`${relative}/TASK.md`)) return `${relative}/TASK.md`;
  }

  const matches: string[] = [];
  for (const file of fileSet) {
    if (file === path || file.endsWith(`/${path}`)) matches.push(file);
  }
  if (matches.length === 1) return matches[0] ?? path;

  if (fileSet.has(`${path}/SKILL.md`)) return `${path}/SKILL.md`;
  if (fileSet.has(`skills/${path}/SKILL.md`)) return `skills/${path}/SKILL.md`;
  if (fileSet.has(`${path}/TASK.md`)) return `${path}/TASK.md`;
  if (fileSet.has(`tasks/${path}/TASK.md`)) return `tasks/${path}/TASK.md`;

  return path;
}

export function knowledgeLinkTarget(
  path: string,
  files: Iterable<string>,
  from?: string,
): KnowledgeLinkTarget | null {
  const resolved = resolveOfficeLibraryPath(path, files, from);
  const prefix = `${path}/`;
  for (const file of files) {
    if (file === resolved || file === path) return "file";
    if (file.startsWith(prefix)) return "folder";
  }
  return null;
}
