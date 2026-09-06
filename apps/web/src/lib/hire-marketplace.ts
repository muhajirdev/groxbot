import {
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
  return ["All", ...new Set(catalog.map((row) => row.category))];
}
