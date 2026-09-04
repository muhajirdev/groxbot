import { describe, expect, it } from "vitest";
import { OFFICE_MESSAGES_GC_TIME } from "./office-messages";
import {
  catalogToCards,
  composioLogoUrl,
  parseComposioCatalog,
  placeholderConnectorCard,
  PLUGIN_CATALOG_KEY,
  PLUGIN_SKILLS,
  pluginCatalogQueryOptions,
} from "./plugins";

describe("plugin catalog", () => {
  it("skips the composio meta toolkit", () => {
    const cards = catalogToCards(
      parseComposioCatalog([
        { slug: "composio", name: "Composio" },
        {
          slug: "gmail",
          name: "Gmail",
          description: "Mail",
          category: "email",
        },
      ]),
    );
    expect(cards.map((item) => item.id)).toEqual(["gmail"]);
    expect(cards[0]?.category).toBe("Email");
  });

  it("truncates blurbs so IndexedDB does not keep the GitHub payload", () => {
    const [row] = parseComposioCatalog([
      { slug: "gmail", name: "Gmail", description: "x".repeat(400) },
    ]);
    expect(row?.description).toHaveLength(160);
  });

  it("does not store logo URLs on cards — the img src is derived", () => {
    const [card] = catalogToCards(
      parseComposioCatalog([{ slug: "gmail", name: "Gmail" }]),
    );
    expect(card?.logo).toBeUndefined();
    expect(composioLogoUrl("gmail")).toBe(
      "https://logos.composio.dev/api/gmail",
    );
  });

  it("names a connection before the catalog arrives", () => {
    expect(placeholderConnectorCard("google_drive")).toMatchObject({
      id: "google_drive",
      name: "Google Drive",
      kind: "connector",
    });
  });

  it("fetches once then stays fresh for a day, long enough to persist", () => {
    const options = pluginCatalogQueryOptions();
    expect(options.queryKey).toEqual(PLUGIN_CATALOG_KEY);
    expect(options.staleTime).toBe(24 * 60 * 60 * 1000);
    expect(options.gcTime).toBe(OFFICE_MESSAGES_GC_TIME);
    expect(PLUGIN_SKILLS.map((item) => item.id)).toEqual([
      "docs-canvas",
      "pr-canvas",
    ]);
  });

  it("hotlinks Composio logos for <img>, including granola_mcp", () => {
    expect(composioLogoUrl("granola_mcp")).toBe(
      "https://logos.composio.dev/api/granola_mcp",
    );
  });
});
