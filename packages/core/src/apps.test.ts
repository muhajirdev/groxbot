import type { TemplateId } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { applyAppTitle, appsFromMessageBlocks } from "./apps.js";

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

describe("appsFromMessageBlocks", () => {
  it("returns an empty list when there are no app cards", () => {
    expect(
      appsFromMessageBlocks([
        {
          blocks: [{ kind: "text", text: "hello" }],
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ]),
    ).toEqual([]);
  });

  it("dedupes by appId, keeps the earliest time and latest title", () => {
    expect(
      appsFromMessageBlocks([
        {
          blocks: [
            { kind: "app", appId: "a1", templateId: "slides", title: "Q3" },
          ],
          createdAt: "2026-08-02T00:00:00.000Z",
        },
        {
          blocks: [
            {
              kind: "app",
              appId: "a1",
              templateId: "slides",
              title: "Q3 deck",
            },
            { kind: "app", appId: "a2", templateId: "docs", title: "Notes" },
          ],
          createdAt: "2026-08-03T00:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        id: "a2",
        templateId: "docs",
        title: "Notes",
        createdAt: "2026-08-03T00:00:00.000Z",
      },
      {
        id: "a1",
        templateId: "slides",
        title: "Q3 deck",
        createdAt: "2026-08-02T00:00:00.000Z",
      },
    ]);
  });
});
