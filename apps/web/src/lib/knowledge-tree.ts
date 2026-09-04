import type { KnowledgeEntry } from "@groxbot/contracts";

export type KnowledgeTreeNode = {
  path: string;
  name: string;
  kind: "dir" | "file";
  title: string;
  description: string;
  encoding?: "text" | "binary";
  children: KnowledgeTreeNode[];
};

export function nestKnowledgeTree(
  entries: KnowledgeEntry[],
): KnowledgeTreeNode[] {
  const dirs = new Map<string, KnowledgeTreeNode>();
  const roots: KnowledgeTreeNode[] = [];

  function dirNode(path: string, name: string): KnowledgeTreeNode {
    const existing = dirs.get(path);
    if (existing) return existing;
    const node: KnowledgeTreeNode = {
      path,
      name,
      kind: "dir",
      title: name,
      description: "",
      children: [],
    };
    dirs.set(path, node);
    return node;
  }

  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  for (const entry of sorted) {
    const parts = entry.path.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join("/");
      if (dirs.has(dirPath)) continue;
      const label = displayName(parts[i] ?? dirPath);
      const node = dirNode(dirPath, label);
      if (i === 0) roots.push(node);
      else dirs.get(parts.slice(0, i).join("/"))?.children.push(node);
    }
    const leaf: KnowledgeTreeNode = {
      path: entry.path,
      name: displayName(entry.name),
      kind: "file",
      title: entry.title,
      description: entry.description,
      encoding: entry.encoding,
      children: [],
    };
    if (parts.length === 1) roots.push(leaf);
    else dirs.get(parts.slice(0, -1).join("/"))?.children.push(leaf);
  }

  sortTree(roots);
  return roots;
}

export function filterKnowledgeTree(
  nodes: KnowledgeTreeNode[],
  query: string,
): KnowledgeTreeNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return nodes;
  const next: KnowledgeTreeNode[] = [];
  for (const node of nodes) {
    const self =
      node.name.toLowerCase().includes(needle) ||
      node.title.toLowerCase().includes(needle) ||
      node.description.toLowerCase().includes(needle);
    if (self && node.kind !== "dir") {
      next.push(node);
      continue;
    }
    const children = filterKnowledgeTree(node.children, query);
    if (children.length > 0 || (self && node.kind === "dir")) {
      next.push(self && node.kind === "dir" ? node : { ...node, children });
    }
  }
  return next;
}

export function isOfficeSkillPath(path: string): boolean {
  return path === "SKILL.md" || path.endsWith("/SKILL.md");
}

export function officeSkills(
  entries: KnowledgeEntry[],
): Array<{ name: string; description: string }> {
  const seen = new Set<string>();
  const skills: Array<{ name: string; description: string }> = [];
  for (const row of entries) {
    if (!isOfficeSkillPath(row.path)) continue;
    const folder =
      row.path === "SKILL.md" ? "" : row.path.slice(0, -"/SKILL.md".length);
    // activate_skill uses YAML `name` (list title), not the folder.
    const name =
      row.title.trim() || folder.split("/").filter(Boolean).at(-1) || "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    skills.push({ name, description: row.description });
  }
  return skills;
}

function displayName(name: string): string {
  return name.replace(/\.md$/iu, "") || name;
}

function sortTree(nodes: KnowledgeTreeNode[]) {
  nodes.sort((a, b) => {
    if (a.kind === "dir" && b.kind !== "dir") return -1;
    if (a.kind !== "dir" && b.kind === "dir") return 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) sortTree(node.children);
}
