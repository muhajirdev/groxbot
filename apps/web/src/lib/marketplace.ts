import type { PluginCard } from "./plugins";

export type MarketplaceTab = "plugins" | "bots" | "skills";

export type MarketplaceView = "browse" | "installed";

/** Popular connectors to pin under Featured when present in the catalog. */
export const FEATURED_PLUGIN_IDS = [
  "gmail",
  "slack",
  "notion",
  "github",
  "googlecalendar",
  "linear",
  "googledocs",
  "googlesheets",
  "outlook",
  "jira",
] as const;

const FEATURED_PLUGIN_SET = new Set<string>(FEATURED_PLUGIN_IDS);

/** How many category chips sit before the More menu (All / Featured are separate). */
export const MARKETPLACE_CHIP_BUDGET = 3;

/** Rows shown per category section before View all. */
export const MARKETPLACE_SECTION_PREVIEW = 2;

/** Category sections under All (Featured is separate). */
export const MARKETPLACE_ALL_CATEGORY_SECTIONS = 2;

export function isMarketplaceTab(value: string): value is MarketplaceTab {
  return value === "plugins" || value === "bots" || value === "skills";
}

export function marketplaceSearchPlaceholder(tab: MarketplaceTab): string {
  if (tab === "bots") return "Search bots";
  if (tab === "skills") return "Search skills";
  return "Search plugins";
}

export function marketplaceInstalledSummary(input: {
  installed: number;
  privateCount: number;
}): string {
  const installed =
    input.installed === 1 ? "1 installed" : `${input.installed} installed`;
  if (input.privateCount <= 0) return installed;
  const priv =
    input.privateCount === 1 ? "1 private" : `${input.privateCount} private`;
  return `${installed} · ${priv}`;
}

/** Split category labels (no All) into visible chips + overflow for More. */
export function marketplaceChipSplit(
  categories: readonly string[],
  budget = MARKETPLACE_CHIP_BUDGET,
): { shown: string[]; more: string[] } {
  const list = categories.filter((label) => label !== "All");
  if (list.length <= budget) return { shown: list, more: [] };
  return {
    shown: list.slice(0, budget),
    more: list.slice(budget),
  };
}

export function featuredPluginCards(
  catalog: readonly PluginCard[],
  limit = 4,
): PluginCard[] {
  const connectors = catalog.filter((item) => item.kind === "connector");
  const pinned = FEATURED_PLUGIN_IDS.map((id) =>
    connectors.find((item) => item.id === id),
  ).filter((item): item is PluginCard => Boolean(item));
  if (pinned.length >= limit) return pinned.slice(0, limit);
  const have = new Set(pinned.map((item) => item.id));
  for (const item of connectors) {
    if (have.has(item.id)) continue;
    pinned.push(item);
    if (pinned.length >= limit) break;
  }
  return pinned;
}

export function isFeaturedPluginId(id: string): boolean {
  return FEATURED_PLUGIN_SET.has(id);
}

export type MarketplaceSection<T> = {
  key: string;
  title: string;
  items: T[];
  /** True when more items exist beyond the preview. */
  hasMore: boolean;
};

/**
 * Browse sections: Featured first (when All / Featured), then category groups.
 * A concrete category chip shows one flat section. Search flattens to Matches.
 */
export function marketplaceBrowseSections<T extends { id: string; category: string }>(input: {
  items: readonly T[];
  featured: readonly T[];
  category: string | null;
  /** Special chip: only featured. */
  featuredOnly?: boolean;
  query: string;
  preview?: number;
  /** When set, that category shows every item (View all). */
  expandedCategory?: string | null;
  /** Cap category sections on All (Featured excluded). */
  maxCategorySections?: number;
}): MarketplaceSection<T>[] {
  const preview = input.preview ?? MARKETPLACE_SECTION_PREVIEW;
  const q = input.query.trim();
  if (q) {
    return input.items.length
      ? [
          {
            key: "matches",
            title: "Results",
            items: [...input.items],
            hasMore: false,
          },
        ]
      : [];
  }
  if (input.featuredOnly) {
    return input.featured.length
      ? [
          {
            key: "featured",
            title: "Featured",
            items: [...input.featured],
            hasMore: false,
          },
        ]
      : [];
  }
  if (input.category) {
    const items = input.items.filter((row) => row.category === input.category);
    return items.length
      ? [
          {
            key: input.category,
            title: input.category,
            items,
            hasMore: false,
          },
        ]
      : [];
  }

  const sections: MarketplaceSection<T>[] = [];
  if (input.featured.length) {
    sections.push({
      key: "featured",
      title: "Featured",
      items: [...input.featured],
      hasMore: false,
    });
  }

  const byCategory = new Map<string, T[]>();
  for (const item of input.items) {
    if (input.featured.some((row) => row.id === item.id)) continue;
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }
  const maxCats =
    input.maxCategorySections ?? MARKETPLACE_ALL_CATEGORY_SECTIONS;
  let cats = 0;
  for (const [title, all] of byCategory) {
    if (cats >= maxCats) break;
    cats += 1;
    const expanded = input.expandedCategory === title;
    const items = expanded ? all : all.slice(0, preview);
    sections.push({
      key: title,
      title,
      items,
      hasMore: !expanded && all.length > preview,
    });
  }
  return sections;
}

export function uniqueCategoriesInOrder<T extends { category: string }>(
  items: readonly T[],
): string[] {
  return [...new Set(items.map((row) => row.category))];
}
