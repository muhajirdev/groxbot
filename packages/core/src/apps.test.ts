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
});
