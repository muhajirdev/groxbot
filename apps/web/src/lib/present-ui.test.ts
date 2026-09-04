import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultGenerativeUILibrary } from "@assistant-ui/react-generative-ui";
import { PRESENT_TYPES } from "@groxbot/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ComputerFileOpenProvider,
  KnowledgeFileOpenProvider,
} from "../components/ChatFileLink";
import { PresentSurface } from "../components/PresentToolUI";

describe("PresentSurface", () => {
  it("keeps a long Fact value from crushing the label column", () => {
    const html = renderToStaticMarkup(
      createElement(PresentSurface, {
        tree: {
          $type: "Card",
          title: "Protocol",
          children: [
            {
              $type: "Fact",
              label: "Diet",
              value:
                "~1,977 kcal/day vegan, 3 meals (6am, 7am, 11am) — eating window ends ~noon",
            },
          ],
        },
      }),
    );
    expect(html).toContain('data-aui="fact-label">Diet<');
    expect(html).toContain("1,977 kcal/day");
  });

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

  it("wraps http(s) images in a zoom trigger", () => {
    const html = renderToStaticMarkup(
      createElement(PresentSurface, {
        tree: {
          $type: "Image",
          src: "https://example.com/chart.png",
          alt: "Chart",
        },
      }),
    );
    expect(html).toContain("Click to zoom image");
    expect(html).toContain("<img");
    expect(html).toContain("https://example.com/chart.png");
  });

  it("renders a File chip for a computer path", () => {
    const html = renderToStaticMarkup(
      createElement(PresentSurface, {
        tree: {
          $type: "File",
          path: "notes/q3.md",
          place: "computer",
        },
      }),
    );
    expect(html).toContain('data-aui="file"');
    expect(html).toContain('data-aui="file-mark"');
    expect(html).toContain('data-kind="md"');
    expect(html).toContain("q3.md");
    expect(html).toContain("Computer");
    expect(html).not.toContain("data-aui=\"file-download\"");
  });

  it("adds a download control when a downloader is present", () => {
    const html = renderToStaticMarkup(
      createElement(
        ComputerFileOpenProvider,
        { onOpen: () => undefined, onDownload: () => undefined },
        createElement(PresentSurface, {
          tree: {
            $type: "File",
            path: "notes.md",
            place: "computer",
          },
        }),
      ),
    );
    expect(html).toContain('data-aui="file-download"');
    expect(html).toContain('aria-label="Download notes.md"');
  });

  it("enables a knowledge File chip when an opener is present", () => {
    const html = renderToStaticMarkup(
      createElement(
        KnowledgeFileOpenProvider,
        { onOpen: () => undefined },
        createElement(PresentSurface, {
          tree: {
            $type: "File",
            path: "skills/q3/SKILL.md",
            place: "knowledge",
            title: "Q3 skill",
          },
        }),
      ),
    );
    expect(html).toContain("Q3 skill");
    expect(html).toContain("Knowledge");
    expect(html).not.toContain("disabled");
  });

  it("covers the default vocabulary and the office File type", () => {
    expect(PRESENT_TYPES.filter((type) => type !== "File").sort()).toEqual(
      Object.keys(defaultGenerativeUILibrary).sort(),
    );
    expect(PRESENT_TYPES).toContain("File");
  });

  it("puts each Fact label on its own line inside the thread bubble", () => {
    const css = readFileSync(
      join(import.meta.dirname, "../styles.css"),
      "utf8",
    );
    expect(css).toMatch(/\[data-aui="fact"\] \{\n  display: grid;\n  gap: 3px;/);
    expect(css).toMatch(/\[data-aui="fact"\] > \* \{\n  display: block;/);
    expect(css).not.toContain('content: " · "');
    expect(css).toMatch(
      /\[data-aui="card"\] \{\n  display: grid;\n  gap: 12px;\n  background: none;\n  border: 0;/,
    );
    expect(css).toContain(
      '[data-aui="root"]:has(> [data-aui="file"]:only-child)',
    );
  });
});
