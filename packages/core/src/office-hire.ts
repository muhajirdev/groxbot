import {
  BOT_MARKETPLACE_CATALOG,
  BOT_MARKETPLACE_CATEGORIES,
  filterBotMarketplace,
  getBotMarketplaceTemplate,
} from "@groxbot/contracts";

export class OfficeHireError extends Error {
  constructor(message = "Could not hire that teammate.") {
    super(message);
    this.name = "OfficeHireError";
  }
}

export type OfficeHireInput = {
  name?: string;
  title?: string;
  description?: string;
  instructions?: string;
  marketplaceId?: string;
};

export function officeMarketplaceHits(input: {
  query?: string;
  category?: string | null;
  limit?: number;
}): {
  count: number;
  categories: string[];
  bots: Array<{
    id: string;
    name: string;
    title: string;
    blurb: string;
    category: string;
    kind: string;
  }>;
} {
  const raw = input.limit ?? 12;
  const limit = Math.min(Math.max(raw, 1), 20);
  const hits = filterBotMarketplace(
    BOT_MARKETPLACE_CATALOG,
    input.query ?? "",
    input.category?.trim() || null,
  ).slice(0, limit);
  return {
    count: hits.length,
    categories: [...BOT_MARKETPLACE_CATEGORIES],
    bots: hits.map((row) => ({
      id: row.id,
      name: row.name,
      title: row.title ?? "",
      blurb: row.blurb,
      category: row.category,
      kind: row.kind,
    })),
  };
}

/** Resolve a Code Mode hire into `bots.create` fields. Marketplace id wins identity. */
export function resolveOfficeHire(input: OfficeHireInput): {
  name: string;
  title: string;
  description: string;
  instructions: string;
  marketplaceId?: string;
} {
  const marketplaceId = input.marketplaceId?.trim();
  if (marketplaceId) {
    const pack = getBotMarketplaceTemplate(marketplaceId);
    if (!pack) {
      throw new OfficeHireError(`Unknown marketplace bot: ${marketplaceId}`);
    }
    const personTitle =
      pack.kind === "person" && pack.title?.trim()
        ? pack.title.trim()
        : (input.title?.trim() ?? "");
    return {
      name: pack.name,
      title: personTitle,
      description: pack.blurb,
      instructions: pack.soul,
      marketplaceId,
    };
  }
  const name = input.name?.trim();
  if (!name) {
    throw new OfficeHireError(
      "Pass marketplaceId from bots.search, or a name.",
    );
  }
  return {
    name: name.slice(0, 80),
    title: (input.title?.trim() ?? "").slice(0, 160),
    description: (input.description?.trim() ?? "").slice(0, 4000),
    instructions: (input.instructions?.trim() ?? "").slice(0, 20000),
  };
}

export function officeHiredBotProjection(bot: {
  id: string;
  name: string;
  title: string;
  homeRoomId: string;
}): {
  id: string;
  name: string;
  title: string;
  homeRoomId: string;
  hint: string;
} {
  return {
    id: bot.id,
    name: bot.name,
    title: bot.title,
    homeRoomId: bot.homeRoomId,
    hint: "They are on the roster. The human opens them from the sidebar — empty desk until someone writes.",
  };
}
