import type { TemplateId } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { applyAppTitle } from "./apps.js";

describe("applyAppTitle", () => {
  it("sets the docs title", () => {
    expect(
      applyAppTitle("docs", { title: "Untitled", html: "<p></p>" }, "Q3"),
    ).toEqual({ title: "Q3", html: "<p></p>" });
  });

  it("sets the first slide title", () => {
    const next = applyAppTitle(
      "slides" as TemplateId,
      { slides: [{ id: "s1", title: "Untitled deck", body: "x" }] },
      "Q3",
    ) as { slides: Array<{ title: string }> };
    expect(next.slides[0]?.title).toBe("Q3");
  });

  it("sets the cover title block on a workspace deck", () => {
    const next = applyAppTitle(
      "slides" as TemplateId,
      {
        themeVersion: "workspace.1",
        slides: [
          {
            id: "s1",
            title: "Untitled deck",
            blocks: [
              {
                type: "title",
                props: { text: "Untitled deck" },
              },
            ],
          },
        ],
      },
      "Q3",
    ) as {
      slides: Array<{
        title: string;
        blocks: Array<{ props: { text: string } }>;
      }>;
    };
    expect(next.slides[0]?.title).toBe("Q3");
    expect(next.slides[0]?.blocks[0]?.props.text).toBe("Q3");
  });
});
