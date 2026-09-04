import { placeholderConnectorCard, type PluginCard } from "./plugins";

export type PluginTab = "search" | "installed";

/** Installed connections still have a card before the GitHub catalog arrives. */
export function catalogWithInstalledPlaceholders(
  catalog: PluginCard[],
  installedIds: ReadonlySet<string>,
): PluginCard[] {
  if (installedIds.size === 0) return catalog;
  const have = new Set(catalog.map((item) => item.id));
  const extra: PluginCard[] = [];
  for (const id of installedIds) {
    if (have.has(id)) continue;
    extra.push(placeholderConnectorCard(id));
  }
  return extra.length ? [...catalog, ...extra] : catalog;
}

export function visiblePluginCards(
  catalog: PluginCard[],
  query: string,
  tab: PluginTab,
  installedToolkits: ReadonlySet<string>,
): PluginCard[] {
  const q = query.trim().toLowerCase();
  return catalog.filter((item) => {
    if (q && !item.name.toLowerCase().includes(q) && !item.id.includes(q)) {
      return false;
    }
    if (tab === "installed") return installedToolkits.has(item.id);
    return true;
  });
}

export function groupVisiblePlugins(
  tab: PluginTab,
  visible: PluginCard[],
): Map<string, PluginCard[]> {
  if (tab === "installed") {
    const installed = visible.filter((item) => item.kind === "connector");
    const skills = visible.filter((item) => item.kind === "skill");
    const next = new Map<string, PluginCard[]>();
    if (installed.length) next.set("Installed", installed);
    if (skills.length) next.set("Skills", skills);
    return next;
  }
  const map = new Map<string, PluginCard[]>();
  for (const item of visible) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return map;
}

export function matchesMcpQuery(
  name: string,
  url: string,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return name.toLowerCase().includes(q) || url.toLowerCase().includes(q);
}

export function mcpHostLabel(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

export function mcpProbeSummary(
  probe: { ok: boolean; tools: readonly string[]; error: string | null },
  fallback: string,
): string {
  if (!probe.ok) return probe.error?.trim() || "Not answering";
  if (probe.tools.length === 0) return `${fallback} · live, no tools yet`;
  const shown = probe.tools.slice(0, 3).join(", ");
  const more = probe.tools.length > 3 ? ` +${probe.tools.length - 3}` : "";
  const noun = probe.tools.length === 1 ? "tool" : "tools";
  return `${probe.tools.length} ${noun} · ${shown}${more}`;
}

export function mcpNeedsReconnect(
  row: { status: string; hostBotId: string | null },
  probe?: { ok: boolean } | null,
): boolean {
  if (row.status !== "connected") return false;
  return !row.hostBotId || probe?.ok === false;
}

export function pluginGridColumns(
  width: number,
  minCard = 200,
  gap = 10,
): number {
  if (width <= 0) return 1;
  return Math.max(1, Math.floor((width + gap) / (minCard + gap)));
}

export type PluginListRow =
  | { type: "label"; key: string; category: string }
  | { type: "row"; key: string; items: PluginCard[] };

export function pluginListRows(
  groups: Map<string, PluginCard[]>,
  columns: number,
): PluginListRow[] {
  const cols = Math.max(1, Math.floor(columns));
  const rows: PluginListRow[] = [];
  for (const [category, items] of groups) {
    rows.push({ type: "label", key: `label:${category}`, category });
    for (let i = 0; i < items.length; i += cols) {
      const slice = items.slice(i, i + cols);
      const first = slice[0]?.id ?? String(i);
      rows.push({
        type: "row",
        key: `row:${category}:${first}`,
        items: slice,
      });
    }
  }
  return rows;
}
