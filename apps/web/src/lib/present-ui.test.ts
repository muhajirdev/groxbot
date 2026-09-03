import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PresentSurface } from "../components/PresentToolUI";

describe("PresentSurface", () => {
  it("renders a Card of Facts", () => {
    const html = renderToStaticMarkup(
      createElement(PresentSurface, {
        tree: {
          $type: "Card",
          title: "Q3",
          children: [
            { $type: "Fact", label: "Bookings", value: "$1.2M" },
            { $type: "Fact", label: "Growth", value: "+18%" },
          ],
        },
      }),
    );
    expect(html).toContain('data-aui="card"');
    expect(html).toContain("Q3");
    expect(html).toContain("Bookings");
    expect(html).toContain("$1.2M");
    expect(html).toContain("+18%");
  });

  it("drops unknown $type nodes", () => {
    const html = renderToStaticMarkup(
      createElement(PresentSurface, {
        tree: { $type: "eval", script: "alert(1)" },
      }),
    );
    expect(html).toBe("");
    expect(html).not.toContain("alert(1)");
  });

  it("does not render javascript: images", () => {
    const html = renderToStaticMarkup(
      createElement(PresentSurface, {
        tree: {
          $type: "Image",
          src: "javascript:alert(1)",
          alt: "x",
        },
      }),
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<img");
  });
});
