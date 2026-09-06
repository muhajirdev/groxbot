import type { AvatarShape } from "@groxbot/contracts";
import {
  filterBotMarketplace,
  type BotMarketplaceTemplate,
} from "@groxbot/contracts";
import { AVATAR_COLORS, AVATAR_SHAPES } from "./jobs";

/** Visible marketplace cards for the current search + category. */
export function hireMarketplaceCards(input: {
  catalog: readonly BotMarketplaceTemplate[];
  query: string;
  category: string | null;
  all?: boolean;
}): BotMarketplaceTemplate[] {
  const filtered = filterBotMarketplace(
    input.catalog,
    input.query,
    input.category,
  );
  const searching = Boolean(input.query.trim() || input.category);
  if (input.all || searching) return filtered;
  return filtered.filter((row) => row.starter);
}

/** Category chip labels: All first, then unique categories in catalog order. */
export function hireMarketplaceCategories(
  catalog: readonly BotMarketplaceTemplate[],
): string[] {
  return ["All", ...new Set(catalog.map((row) => row.category))];
}

/** Stable roster face for a catalog row so the list matches the hire. */
export function marketplaceAvatar(id: string): {
  color: string;
  shape: AvatarShape;
} {
  let n = 0;
  for (const ch of id) n = (n * 33 + ch.charCodeAt(0)) | 0;
  const i = Math.abs(n);
  return {
    color: AVATAR_COLORS[i % AVATAR_COLORS.length] ?? AVATAR_COLORS[0],
    shape:
      AVATAR_SHAPES[
        Math.floor(i / AVATAR_COLORS.length) % AVATAR_SHAPES.length
      ] ?? "circle",
  };
}
