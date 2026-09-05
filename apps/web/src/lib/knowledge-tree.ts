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
      const label = parts[i] ?? dirPath;
      const node = dirNode(dirPath, label);
      if (i === 0) roots.push(node);
      else dirs.get(parts.slice(0, i).join("/"))?.children.push(node);
    }
    const leaf: KnowledgeTreeNode = {
      path: entry.path,
      name: entry.name,
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

export function findKnowledgeNode(
  nodes: readonly KnowledgeTreeNode[],
  path: string,
): KnowledgeTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    const nested = findKnowledgeNode(node.children, path);
    if (nested) return nested;
  }
  return null;
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

/** Parent folder of a SKILL.md. Empty when the file sits at the office root. */
export function officeSkillDirectory(path: string): string {
  if (path === "SKILL.md") return "";
  if (path.endsWith("/SKILL.md")) return path.slice(0, -"/SKILL.md".length);
  return "";
}

export type OfficeSkillRow = {
  name: string;
  description: string;
  path: string;
  directory: string;
  files: number;
  pack: string;
};

export type OfficeSkillFile = {
  path: string;
  name: string;
  title: string;
  description: string;
};

export type OfficeSkillPackKind =
  | "playbook"
  | "references"
  | "scripts"
  | "templates"
  | "examples"
  | "assets"
  | "other";

export type OfficeSkillPackGroup = {
  kind: OfficeSkillPackKind;
  label: string;
  files: OfficeSkillFile[];
};

const PACK_KIND_ORDER: OfficeSkillPackKind[] = [
  "playbook",
  "references",
  "scripts",
  "templates",
  "examples",
  "assets",
  "other",
];

const PACK_KIND_LABEL: Record<OfficeSkillPackKind, string> = {
  playbook: "Playbook",
  references: "References",
  scripts: "Scripts",
  templates: "Templates",
  examples: "Examples",
  assets: "Assets",
  other: "Other",
};

const PACK_FOLDERS: Record<string, OfficeSkillPackKind> = {
  references: "references",
  scripts: "scripts",
  templates: "templates",
  examples: "examples",
  assets: "assets",
};

export function officeSkillPackKind(relativePath: string): OfficeSkillPackKind {
  if (relativePath === "SKILL.md") return "playbook";
  const folder = relativePath.split("/")[0] ?? "";
  return PACK_FOLDERS[folder] ?? "other";
}

export function officeSkillFileLabel(file: OfficeSkillFile): string {
  return file.name.split("/").filter(Boolean).at(-1) ?? file.name;
}

export function groupOfficeSkillFiles(
  files: readonly OfficeSkillFile[],
): OfficeSkillPackGroup[] {
  const buckets = new Map<OfficeSkillPackKind, OfficeSkillFile[]>();
  for (const file of files) {
    const kind = officeSkillPackKind(file.name);
    const list = buckets.get(kind) ?? [];
    list.push(file);
    buckets.set(kind, list);
  }
  return PACK_KIND_ORDER.flatMap((kind) => {
    const group = buckets.get(kind);
    if (!group?.length) return [];
    return [{ kind, label: PACK_KIND_LABEL[kind], files: group }];
  });
}

/** Short line for the skills list: "references · scripts". */
export function officeSkillPackSummary(
  files: readonly OfficeSkillFile[],
): string {
  return groupOfficeSkillFiles(files)
    .filter((group) => group.kind !== "playbook")
    .map((group) => group.label.toLowerCase())
    .join(" · ");
}

function skillNameOf(entry: KnowledgeEntry, directory: string): string {
  return (
    entry.title.trim() || directory.split("/").filter(Boolean).at(-1) || ""
  );
}

function pathInFolder(path: string, folder: string): boolean {
  if (!folder) return true;
  return path === `${folder}/SKILL.md` || path.startsWith(`${folder}/`);
}

/** Markdown and other files that belong to one playbook folder. */
export function officeSkillFiles(
  entries: readonly KnowledgeEntry[],
  directory: string,
): OfficeSkillFile[] {
  const prefix = directory ? `${directory}/` : "";
  const files: OfficeSkillFile[] = [];
  for (const entry of entries) {
    if (directory) {
      if (entry.path === directory) continue;
      if (!entry.path.startsWith(prefix)) continue;
    } else if (entry.path !== "SKILL.md") {
      continue;
    }
    files.push({
      path: entry.path,
      name: prefix ? entry.path.slice(prefix.length) : entry.path,
      title: entry.title,
      description: entry.description,
    });
  }
  files.sort((a, b) => {
    const aSkill = isOfficeSkillPath(a.path);
    const bSkill = isOfficeSkillPath(b.path);
    if (aSkill !== bSkill) return aSkill ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return files;
}

/** Playbooks in a knowledge folder (usually `skills/`). One row per SKILL.md, not per file. */
export function officeSkillRows(
  entries: readonly KnowledgeEntry[],
  folder = "skills",
): OfficeSkillRow[] {
  const rows: OfficeSkillRow[] = [];
  for (const entry of entries) {
    if (!isOfficeSkillPath(entry.path)) continue;
    if (!pathInFolder(entry.path, folder)) continue;
    const directory = officeSkillDirectory(entry.path);
    const name = skillNameOf(entry, directory);
    if (!name) continue;
    const packFiles = officeSkillFiles(entries, directory);
    rows.push({
      name,
      description: entry.description,
      path: entry.path,
      directory,
      files: packFiles.length,
      pack: officeSkillPackSummary(packFiles),
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export function filterOfficeSkillRows(
  rows: readonly OfficeSkillRow[],
  query: string,
): OfficeSkillRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter(
    (row) =>
      row.name.toLowerCase().includes(needle) ||
      row.description.toLowerCase().includes(needle),
  );
}

/** Rank playbooks by office-search hits; fall back to name/description filter. */
export function rankOfficeSkillRows(
  rows: readonly OfficeSkillRow[],
  hits: readonly { path: string }[] | undefined,
  query: string,
): OfficeSkillRow[] {
  if (!query.trim()) return [...rows];
  if (!hits?.length) return filterOfficeSkillRows(rows, query);
  const ranked: OfficeSkillRow[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const match = matchingOfficeSkill(rows, hit.path);
    if (!match || seen.has(match.path)) continue;
    seen.add(match.path);
    ranked.push(match);
  }
  return ranked.length > 0 ? ranked : filterOfficeSkillRows(rows, query);
}

export function countOfficeSkillHits(
  rows: readonly OfficeSkillRow[],
  hits: readonly { path: string }[],
): number {
  const seen = new Set<string>();
  for (const hit of hits) {
    const match = matchingOfficeSkill(rows, hit.path);
    if (match) seen.add(match.path);
  }
  return seen.size;
}

export type KnowledgeSearchStatus = {
  label: string;
  busy: boolean;
};

/** Quiet line under the knowledge search field. */
export function knowledgeSearchStatus(input: {
  query: string;
  fetching: boolean;
  hitCount: number;
  fallbackCount: number;
  kind?: "library" | "skills";
}): KnowledgeSearchStatus | null {
  if (!input.query.trim()) return null;
  const playbooks = input.kind === "skills";
  if (input.fetching && input.hitCount === 0) {
    return {
      label: playbooks ? "Searching playbooks…" : "Searching notes…",
      busy: true,
    };
  }
  if (input.hitCount > 0) {
    const n = input.hitCount;
    const noun = playbooks
      ? n === 1
        ? "playbook"
        : "playbooks"
      : n === 1
        ? "note"
        : "notes";
    return {
      label: input.fetching ? `Searching… ${n} ${noun}` : `${n} ${noun}`,
      busy: input.fetching,
    };
  }
  if (input.fallbackCount > 0) {
    return { label: "Matching names", busy: input.fetching };
  }
  return input.fetching
    ? {
        label: playbooks ? "Searching playbooks…" : "Searching notes…",
        busy: true,
      }
    : null;
}

/** The playbook that owns this path — the SKILL.md, its folder, or a file under it. */
export function matchingOfficeSkill(
  rows: readonly OfficeSkillRow[],
  path: string | null,
): OfficeSkillRow | null {
  if (!path) return null;
  const exact = rows.find((row) => row.path === path);
  if (exact) return exact;
  let best: OfficeSkillRow | null = null;
  for (const row of rows) {
    if (!row.directory) continue;
    if (path === row.directory || path.startsWith(`${row.directory}/`)) {
      if (!best || row.directory.length > best.directory.length) best = row;
    }
  }
  return best;
}

export function officeSkillNode(row: OfficeSkillRow): KnowledgeTreeNode {
  return {
    path: row.path,
    name: "SKILL.md",
    kind: "file",
    title: row.name,
    description: row.description,
    children: [],
  };
}

export type KnowledgeMenuPhase = "actions" | "confirm-delete" | "confirm-share";

export type KnowledgeMenuItem =
  | { id: "download"; label: "Download" }
  | { id: "copy-path"; label: "Copy path" }
  | { id: "use"; label: "Use in chat" }
  | { id: "new-file"; label: "New file" }
  | { id: "share"; label: "Share publicly…" }
  | { id: "copy-public-link"; label: "Copy public link" }
  | { id: "unpublish"; label: "Unpublish" }
  | { id: "confirm-share"; label: string }
  | { id: "cancel-share"; label: "Cancel" }
  | { id: "delete"; label: string; danger: true }
  | { id: "cancel-delete"; label: "Cancel" };

export function knowledgeMenuItems(input: {
  name: string;
  kind: "dir" | "file";
  skill: boolean;
  phase: KnowledgeMenuPhase;
  shared: boolean;
}): KnowledgeMenuItem[] {
  if (input.phase === "confirm-delete") {
    return [
      { id: "delete", label: `Delete ${input.name}`, danger: true },
      { id: "cancel-delete", label: "Cancel" },
    ];
  }
  if (input.phase === "confirm-share") {
    return [
      {
        id: "confirm-share",
        label:
          input.kind === "dir"
            ? "Publish this folder — later files too"
            : `Publish a public link to ${input.name}`,
      },
      { id: "cancel-share", label: "Cancel" },
    ];
  }
  const items: KnowledgeMenuItem[] = [];
  if (input.kind === "dir") {
    items.push({ id: "new-file", label: "New file" });
  } else {
    items.push({ id: "download", label: "Download" });
    if (input.skill) items.push({ id: "use", label: "Use in chat" });
  }
  if (input.shared) {
    items.push({ id: "copy-public-link", label: "Copy public link" });
    items.push({ id: "unpublish", label: "Unpublish" });
  } else {
    items.push({ id: "share", label: "Share publicly…" });
  }
  items.push({ id: "copy-path", label: "Copy path" });
  items.push({ id: "delete", label: "Delete", danger: true });
  return items;
}

export function coversKnowledgePath(
  parent: string,
  child: string | null,
): boolean {
  if (!child) return false;
  return child === parent || child.startsWith(`${parent}/`);
}

export function officeSkills(
  entries: KnowledgeEntry[],
): Array<{ name: string; description: string }> {
  const seen = new Set<string>();
  const skills: Array<{ name: string; description: string }> = [];
  for (const row of entries) {
    if (!isOfficeSkillPath(row.path)) continue;
    const directory = officeSkillDirectory(row.path);
    // Slash /skill:name uses YAML `name` (list title), not the folder.
    const name = skillNameOf(row, directory);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    skills.push({ name, description: row.description });
  }
  return skills;
}

function sortTree(nodes: KnowledgeTreeNode[]) {
  nodes.sort((a, b) => {
    if (a.kind === "dir" && b.kind !== "dir") return -1;
    if (a.kind !== "dir" && b.kind === "dir") return 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) sortTree(node.children);
}
