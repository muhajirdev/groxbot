import { describe, expect, it } from "vitest";
import {
  PRESENT_TOOL_NAME,
  presentPreview,
  presentTreeFromToolPart,
  runPresent,
} from "./present.js";

describe("runPresent", () => {
  it("accepts a Card of Facts", () => {
    const result = runPresent({
      $type: "Card",
      title: "Q3",
      children: [
        { $type: "Fact", label: "Bookings", value: "$1.2M" },
        { $type: "Fact", label: "Growth", value: "+18%" },
      ],
    });
    expect(result).toEqual({
      ok: true,
      $type: "Card",
      preview: "Q3",
    });
  });

  it("rejects a missing $type", () => {
    expect(runPresent({ title: "Nope" })).toEqual({
      ok: false,
      message: "present needs a $type from the office UI vocabulary.",
    });
  });

  it("drops unknown $type nodes", () => {
    expect(runPresent({ $type: "eval", script: "alert(1)" })).toEqual({
      ok: false,
      message: "Unknown present $type “eval”.",
    });
  });

  it("strips javascript: image sources", () => {
    const result = runPresent({
      $type: "Image",
      src: "javascript:alert(1)",
      alt: "x",
    });
    expect(result.ok).toBe(false);
  });

  it("keeps https images", () => {
    expect(
      runPresent({
        $type: "Image",
        src: "https://example.com/chart.png",
        alt: "chart",
      }).ok,
    ).toBe(true);
  });
});

describe("presentPreview", () => {
  it("prefers a card title", () => {
    expect(presentPreview({ $type: "Card", title: "Hiring shortlist" })).toBe(
      "Hiring shortlist",
    );
  });

  it("falls back to a fact pair", () => {
    expect(
      presentPreview({ $type: "Fact", label: "Owner", value: "Reja" }),
    ).toBe("Owner Reja");
  });
});

describe("presentTreeFromToolPart", () => {
  it("reads an AI SDK present tool part", () => {
    expect(
      presentTreeFromToolPart({
        type: `tool-${PRESENT_TOOL_NAME}`,
        input: { $type: "Card", title: "Deck" },
      }),
    ).toEqual({ $type: "Card", title: "Deck" });
  });

  it("ignores other tools", () => {
    expect(
      presentTreeFromToolPart({
        type: "tool-execute",
        input: { $type: "Card", title: "Nope" },
      }),
    ).toBeNull();
  });
});
