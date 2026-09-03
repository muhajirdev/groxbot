import { describe, expect, it } from "vitest";
import { parseComposioCatalog } from "./plugins";

describe("parseComposioCatalog", () => {
  it("drops the composio meta toolkit", () => {
    expect(
      parseComposioCatalog([
        { slug: "composio", name: "Composio" },
        {
          slug: "gmail",
          name: "Gmail",
          description: "Mail",
          category: "email",
        },
      ]),
    ).toEqual([
      {
        id: "gmail",
        name: "Gmail",
        blurb: "Mail",
        category: "email",
        logo: "https://logos.composio.dev/api/gmail",
      },
    ]);
  });
});
