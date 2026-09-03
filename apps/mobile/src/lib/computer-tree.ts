import type { ComputerEntry } from "@groxbot/contracts";

export type ComputerTreeNode = {
  path: string;
  name: string;
  kind: "file" | "dir";
  size?: number;
  children: ComputerTreeNode[];
};

export function nestComputerEntries(
  entries: ComputerEntry[],
): ComputerTreeNode[] {
  const dirs = new Map<string, ComputerTreeNode>();
  const root: ComputerTreeNode[] = [];

  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  for (const entry of sorted) {
    const parts = entry.path.split("/").filter(Boolean);
    const name = parts.at(-1) ?? entry.path;
    const node: ComputerTreeNode = {
      path: entry.path,
      name,
      kind: entry.kind,
      size: entry.size,
      children: [],
    };
    if (entry.kind === "dir") dirs.set(entry.path, node);
    const parentPath = parts.slice(0, -1).join("/");
    const parent = parentPath ? dirs.get(parentPath) : undefined;
    if (parent) parent.children.push(node);
    else root.push(node);
  }

  sortTree(root);
  return root;
}

function sortTree(nodes: ComputerTreeNode[]) {
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) sortTree(node.children);
}

export function filterComputerTree(
  nodes: ComputerTreeNode[],
  query: string,
): ComputerTreeNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return nodes;
  const next: ComputerTreeNode[] = [];
  for (const node of nodes) {
    const self = node.name.toLowerCase().includes(needle);
    if (self) {
      next.push(node);
      continue;
    }
    const children = filterComputerTree(node.children, query);
    if (children.length > 0) next.push({ ...node, children });
  }
  return next;
}
