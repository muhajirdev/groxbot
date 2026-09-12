import { getBotMarketplaceTemplate } from "@groxbot/contracts";
import { getIntegration } from "./integrations";

export type HomeHireCard = {
  id: string;
  name: string;
  category: string;
  apps: readonly string[];
};

const HIRE_STRIP_SEED: ReadonlyArray<{ id: string; apps: readonly string[] }> =
  [
    { id: "clip-bot", apps: ["instagram", "googledrive"] },
    { id: "competitor-watching", apps: ["gmail"] },
    { id: "x-brief", apps: ["twitter"] },
    { id: "pg", apps: ["linkedin"] },
    { id: "overheard", apps: ["reddit", "twitter"] },
    { id: "chief-of-staff", apps: ["gmail", "googledocs"] },
    { id: "talent-scout", apps: ["linkedin"] },
    { id: "company-docs-q-a", apps: ["notion", "googledrive"] },
    { id: "engineer-bot", apps: ["github"] },
    { id: "seo-aeo-desk", apps: ["googledrive"] },
    { id: "last30days", apps: ["gmail"] },
    { id: "office-ops-desk", apps: ["gmail", "googlesheets"] },
  ];

export const HOME_HIRE_STRIP: readonly HomeHireCard[] = HIRE_STRIP_SEED.flatMap(
  (row) => {
    const bot = getBotMarketplaceTemplate(row.id);
    if (!bot) return [];
    const apps = row.apps.filter((slug) => getIntegration(slug));
    if (apps.length === 0) return [];
    return [
      {
        id: bot.id,
        name: bot.name,
        category: bot.category,
        apps,
      },
    ];
  },
);

export function hireApp(slug: string): { name: string; logo: string } {
  const item = getIntegration(slug);
  return {
    name: item?.name ?? slug,
    logo: item?.logo ?? `https://logos.composio.dev/api/${slug}`,
  };
}
