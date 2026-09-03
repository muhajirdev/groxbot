import { defaultGenerativeUILibrary } from "@assistant-ui/react-generative-ui";
import { PRESENT_TYPES } from "@groxbot/contracts";
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

  it("renders Facts when children arrived as a JSON string", () => {
    const html = renderToStaticMarkup(
      createElement(PresentSurface, {
        tree: {
          $type: "Card",
          title: "Demo card",
          children:
            '[{"$type":"Fact","label":"Team","value":"Groxbot Office"},{"$type":"Badge","text":"Live in-thread UI","tone":"positive"}]',
        },
      }),
    );
    expect(html).toContain('data-aui="fact"');
    expect(html).toContain("Team");
    expect(html).toContain("Groxbot Office");
    expect(html).toContain("Live in-thread UI");
    expect(html).not.toContain('[{"$type"');
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

  it("keeps PRESENT_TYPES in lockstep with the default vocabulary", () => {
    expect([...PRESENT_TYPES].sort()).toEqual(
      Object.keys(defaultGenerativeUILibrary).sort(),
    );
  });
});
