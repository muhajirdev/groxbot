import {
  BOT_MARKETPLACE_CATEGORIES,
  filterBotMarketplace,
  type BotMarketplaceTemplate,
} from "@groxbot/contracts";

/** Visible marketplace cards for the current search + category. */
export function hireMarketplaceCards(input: {
  catalog: readonly BotMarketplaceTemplate[];
  query: string;
  category: string | null;
}): BotMarketplaceTemplate[] {
  return filterBotMarketplace(input.catalog, input.query, input.category);
}

/** Category chip labels: All first, then unique categories in catalog order. */
export function hireMarketplaceCategories(
  catalog: readonly BotMarketplaceTemplate[],
): string[] {
  const fromCatalog = [...new Set(catalog.map((row) => row.category))];
  return ["All", ...(fromCatalog.length ? fromCatalog : [...BOT_MARKETPLACE_CATEGORIES])];
}
