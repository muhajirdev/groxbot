import { describe, expect, it } from "vitest";
import {
  PRESENT_TOOL_NAME,
  presentPreview,
  presentTreeFromToolPart,
  runPresent,
  sanitizePresentTree,
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

  it("parses children passed as a JSON string", () => {
    const result = runPresent({
      $type: "Card",
      title: "Demo card",
      children:
        '[{"$type":"Fact","label":"Team","value":"Groxbot Office"},{"$type":"Badge","text":"Live in-thread UI","tone":"positive"}]',
    });
    expect(result).toEqual({
      ok: true,
      $type: "Card",
      preview: "Demo card",
    });
    const tree = sanitizePresentTree({
      $type: "Card",
      title: "Demo card",
      children:
        '[{"$type":"Fact","label":"Team","value":"Groxbot Office"},{"$type":"Badge","text":"Live in-thread UI","tone":"positive"}]',
    });
    expect(tree?.children?.map((child) => child.$type)).toEqual([
      "Fact",
      "Badge",
    ]);
    expect(tree?.children?.[1]).toMatchObject({
      $type: "Badge",
      value: "Live in-thread UI",
    });
  });

  it("accepts a computer File path", () => {
    expect(
      runPresent({
        $type: "File",
        path: "notes/q3.md",
        place: "computer",
      }),
    ).toEqual({
      ok: true,
      $type: "File",
      preview: "q3.md",
    });
  });

  it("rejects a File path that walks up", () => {
    expect(
      runPresent({
        $type: "File",
        path: "../secret.md",
      }),
    ).toEqual({
      ok: false,
      message: "present File needs an office-root path (no ..).",
    });
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

  it("uses a File basename", () => {
    expect(
      presentPreview({
        $type: "File",
        path: "how-we-work/constraints.md",
        place: "knowledge",
      }),
    ).toBe("constraints.md");
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
