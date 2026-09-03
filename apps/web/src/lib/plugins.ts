export type PluginKind = "connector" | "skill";

export type PluginCard = {
  id: string;
  name: string;
  blurb: string;
  category: string;
  kind: PluginKind;
  logo?: string;
};

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

const CATALOG_URL =
  "https://raw.githubusercontent.com/ComposioHQ/composio/master/docs/public/data/toolkits.json";

export type CatalogToolkit = {
  slug: string;
  name: string;
  description: string;
  category: string;
  logo: string;
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
      description: String(row.description ?? "").trim(),
      category: String(row.category ?? "other").trim() || "other",
      logo: String(row.logo ?? "").trim() || composioLogoUrl(slug),
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
    logo: row.logo,
  }));
}

function titleCase(value: string): string {
  return value
    .split(/[\s_/]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

let catalogPromise: Promise<PluginCard[]> | undefined;

export function loadPluginCatalog(): Promise<PluginCard[]> {
  catalogPromise ??= fetchCatalog();
  return catalogPromise;
}

async function fetchCatalog(): Promise<PluginCard[]> {
  try {
    const response = await fetch(CATALOG_URL);
    if (!response.ok) throw new Error(String(response.status));
    return [
      ...catalogToCards(parseComposioCatalog(await response.json())),
      ...PLUGIN_SKILLS,
    ];
  } catch {
    return [
      {
        id: "gmail",
        name: "Gmail",
        blurb: "Read and draft mail when a Bot hits a wall.",
        category: "Featured",
        kind: "connector",
        logo: composioLogoUrl("gmail"),
      },
      {
        id: "github",
        name: "GitHub",
        blurb: "Find PRs. Never merge on its own.",
        category: "Featured",
        kind: "connector",
        logo: composioLogoUrl("github"),
      },
      ...PLUGIN_SKILLS,
    ];
  }
}
