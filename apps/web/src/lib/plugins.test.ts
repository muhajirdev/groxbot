import { describe, expect, it } from "vitest";
import {
  catalogToCards,
  composioLogoUrl,
  parseComposioCatalog,
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
          logo: composioLogoUrl("gmail"),
        },
      ]),
    );
    expect(cards.map((item) => item.id)).toEqual(["gmail"]);
    expect(cards[0]?.category).toBe("Email");
  });

  it("hotlinks Composio logos for <img>, including granola_mcp", () => {
    const [row] = parseComposioCatalog([
      { slug: "granola_mcp", name: "Granola" },
    ]);
    expect(row?.logo).toBe("https://logos.composio.dev/api/granola_mcp");
    expect(composioLogoUrl("granola_mcp")).toBe(row?.logo);
  });
});
