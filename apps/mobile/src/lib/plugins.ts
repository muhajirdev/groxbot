export type PluginCard = {
  id: string;
  name: string;
  blurb: string;
  category: string;
  logo?: string;
};

export function parseComposioCatalog(raw: unknown): PluginCard[] {
  if (!Array.isArray(raw)) return [];
  const out: PluginCard[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const slug = String(row.slug ?? "")
      .trim()
      .toLowerCase();
    const name = String(row.name ?? "").trim();
    if (!slug || !name || slug === "composio") continue;
    out.push({
      id: slug,
      name,
      blurb: String(row.description ?? "").trim(),
      category: String(row.category ?? "other").trim() || "other",
      logo:
        String(row.logo ?? "").trim() ||
        `https://logos.composio.dev/api/${slug}`,
    });
  }
  return out;
}

export async function loadPluginCatalog(): Promise<PluginCard[]> {
  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/ComposioHQ/composio/master/docs/public/data/toolkits.json",
    );
    if (!response.ok) return [];
    return parseComposioCatalog(await response.json());
  } catch {
    return [];
  }
}
