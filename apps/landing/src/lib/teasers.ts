import { featuredIntegrations, INTEGRATIONS } from "./integrations";

export const HOME_INTEGRATIONS = [
  { slug: "linkedin", name: "LinkedIn" },
  { slug: "instagram", name: "Instagram" },
  { slug: "googledrive", name: "Google Drive" },
  { slug: "notion", name: "Notion" },
  { slug: "gmail", name: "Gmail" },
  { slug: "slack", name: "Slack" },
  { slug: "github", name: "GitHub" },
  { slug: "typefully", name: "Typefully" },
] as const;

export type HomeIntegrationChip = {
  slug: string;
  name: string;
  logo: string;
};

const PRIORITY = HOME_INTEGRATIONS.map((item) => item.slug);

/** Two dense rows for the homepage marquee — featured first, then the catalog. */
export const HOME_INTEGRATION_MARQUEE_LIMIT = 96;

export function homeIntegrationMarquee(
  limit = HOME_INTEGRATION_MARQUEE_LIMIT,
): {
  rows: [HomeIntegrationChip[], HomeIntegrationChip[]];
  total: number;
} {
  const seen = new Set<string>();
  const picked: HomeIntegrationChip[] = [];

  function push(
    item: { slug: string; name: string; logo: string } | undefined,
  ) {
    if (!item?.logo || seen.has(item.slug)) return;
    seen.add(item.slug);
    picked.push({ slug: item.slug, name: item.name, logo: item.logo });
  }

  for (const slug of PRIORITY) {
    push(INTEGRATIONS.find((item) => item.slug === slug));
  }
  for (const item of featuredIntegrations()) push(item);
  for (const item of INTEGRATIONS) {
    if (picked.length >= limit) break;
    push(item);
  }

  const mid = Math.ceil(picked.length / 2);
  return {
    rows: [picked.slice(0, mid), picked.slice(mid)],
    total: INTEGRATIONS.length,
  };
}
