import type { PluginCard } from "./plugins";

export type PluginTab = "search" | "installed";

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
