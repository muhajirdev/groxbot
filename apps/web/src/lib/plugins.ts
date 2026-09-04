import { OFFICE_MESSAGES_GC_TIME } from "./office-messages";

export type PluginKind = "connector" | "skill";

export type PluginCard = {
  id: string;
  name: string;
  blurb: string;
  category: string;
  kind: PluginKind;
  logo?: string;
};

export const PLUGIN_CATALOG_KEY = ["plugin-catalog"] as const;

const COMPOSIO_TOOLKITS =
  "https://raw.githubusercontent.com/ComposioHQ/composio/master/docs/public/data/toolkits.json";

/** Card copy is display-only; keep the persisted catalog small. */
const BLURB_MAX = 160;

export const PLUGIN_SKILLS: PluginCard[] = [
  {
    id: "docs-canvas",
    name: "Docs Canvas",
    blurb: "Draft long-form in a canvas, not a wall of chat.",
    category: "Canvas",
    kind: "skill",
  },
  {
    id: "pr-canvas",
    name: "PR Review Canvas",
    blurb: "Review a diff in place.",
    category: "Canvas",
    kind: "skill",
  },
];

export type CatalogToolkit = {
  slug: string;
  name: string;
  description: string;
  category: string;
};

/** Display-only hotlink. logos.composio.dev omits CORS headers. */
export function composioLogoUrl(slug: string): string {
  return `https://logos.composio.dev/api/${slug}`;
}

export function parseComposioCatalog(raw: unknown): CatalogToolkit[] {
  if (!Array.isArray(raw)) return [];
  const out: CatalogToolkit[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const slug = String(row.slug ?? "")
      .trim()
      .toLowerCase();
    const name = String(row.name ?? "").trim();
    if (!slug || !name || slug === "composio") continue;
    out.push({
      slug,
      name,
      description: String(row.description ?? "")
        .trim()
        .slice(0, BLURB_MAX),
      category: String(row.category ?? "other").trim() || "other",
    });
  }
  return out;
}

export function catalogToCards(rows: CatalogToolkit[]): PluginCard[] {
  return rows.map((row) => ({
    id: row.slug,
    name: row.name,
    blurb: row.description,
    category: titleCase(row.category),
    kind: "connector",
  }));
}

export function placeholderConnectorCard(id: string): PluginCard {
  return {
    id,
    name: titleCase(id.replace(/[_-]+/g, " ")),
    blurb: "",
    category: "Installed",
    kind: "connector",
  };
}

function titleCase(value: string): string {
  return value
    .split(/[\s_/]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export async function loadPluginCatalog(): Promise<PluginCard[]> {
  const response = await fetch(COMPOSIO_TOOLKITS);
  if (!response.ok) {
    throw new Error(`plugin catalog ${response.status}`);
  }
  const cards = catalogToCards(parseComposioCatalog(await response.json()));
  if (cards.length === 0) throw new Error("plugin catalog empty");
  return [...cards, ...PLUGIN_SKILLS];
}

/** First open hits GitHub; Query persist then keeps the slim cards in IndexedDB. */
export function pluginCatalogQueryOptions() {
  return {
    queryKey: PLUGIN_CATALOG_KEY,
    queryFn: loadPluginCatalog,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: OFFICE_MESSAGES_GC_TIME,
  };
}
