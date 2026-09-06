import { COMPARE_PAGES } from "../data/compare";
import { USE_CASES } from "../data/use-cases";
import { DISCOVERY_SITEMAP_PATHS } from "./discovery";
import { INTEGRATIONS, integrationCategories } from "./integrations";
import { canonicalUrl } from "./site";

export type SitemapEntry = {
  path: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: string;
};

export function sitemapEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = [
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/integrations", changefreq: "weekly", priority: "0.9" },
    { path: "/use-cases", changefreq: "weekly", priority: "0.9" },
    { path: "/compare", changefreq: "weekly", priority: "0.9" },
    { path: "/press", changefreq: "monthly", priority: "0.6" },
  ];
  for (const path of DISCOVERY_SITEMAP_PATHS) {
    if (entries.some((entry) => entry.path === path)) continue;
    entries.push({ path, changefreq: "weekly", priority: "0.5" });
  }
  for (const category of integrationCategories()) {
    entries.push({
      path: `/integrations/category/${category.slug}`,
      changefreq: "weekly",
      priority: "0.7",
    });
  }
  for (const item of INTEGRATIONS) {
    entries.push({
      path: `/integrations/${item.slug}`,
      changefreq: "weekly",
      priority: item.featured ? "0.8" : "0.6",
    });
  }
  for (const item of USE_CASES) {
    entries.push({
      path: `/use-cases/${item.slug}`,
      changefreq: "weekly",
      priority: "0.8",
    });
  }
  for (const page of COMPARE_PAGES) {
    entries.push({
      path: `/compare/${page.slug}`,
      changefreq: "weekly",
      priority: "0.85",
    });
  }
  return entries;
}

export function sitemapXml(): string {
  const urls = sitemapEntries()
    .map((entry) => {
      const loc = escapeXml(canonicalUrl(entry.path));
      const image =
        entry.path === "/"
          ? `
    <image:image>
      <image:loc>${escapeXml(canonicalUrl("/og.png"))}</image:loc>
      <image:title>Groxbot</image:title>
    </image:image>`
          : "";
      return `  <url>
    <loc>${loc}</loc>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>${image}
  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
