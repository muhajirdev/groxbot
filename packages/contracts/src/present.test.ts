import { describe, expect, it } from "vitest";
import {
  PRESENT_EMPTY_MESSAGE,
  PRESENT_TOOL_NAME,
  PRESENT_TOOL_PARAMETERS,
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

  it("infers File when path is present without $type", () => {
    expect(
      runPresent({ path: "invoice.html", place: "computer" }),
    ).toEqual({
      ok: true,
      $type: "File",
      preview: "invoice.html",
    });
  });

  it("rejects a missing $type", () => {
    expect(runPresent({ title: "Nope" })).toEqual({
      ok: false,
      message: PRESENT_EMPTY_MESSAGE,
    });
    expect(runPresent({})).toEqual({
      ok: false,
      message: PRESENT_EMPTY_MESSAGE,
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

  it("wraps stringified children with no root $type as a Card", () => {
    const result = runPresent({
      children:
        '[{"$type":"Alert","kind":"warning","title":"Needs you","children":[{"$type":"Text","text":"Google security alert"}]},{"$type":"Text","text":"4 newsletters"}]',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.$type).toBe("Card");
    const tree = sanitizePresentTree({
      children:
        '[{"$type":"Alert","kind":"warning","title":"Needs you","children":[{"$type":"Text","text":"Google security alert"}]}]',
    });
    expect(tree?.$type).toBe("Card");
    expect(tree?.children?.[0]).toMatchObject({
      $type: "Alert",
      title: "Needs you",
    });
  });

  it("infers Table when headers/cells are present without $type", () => {
    const result = runPresent({
      $type: "Card",
      title: "Inbox",
      children: [
        {
          $type: "Table",
          children: [
            {
              headers: ["From", "Subject"],
              cells: [["Pat", "Hello"]],
            },
          ],
        },
      ],
    });
    expect(result).toEqual({
      ok: true,
      $type: "Card",
      preview: "Inbox",
    });
    const tree = sanitizePresentTree({
      $type: "Table",
      children: [{ headers: ["From"], cells: [["Pat"]] }],
    });
    expect(tree?.children?.[0]?.$type).toBe("Table");
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

  it("unwraps a card stuffed in raw (Pi invalid-JSON wrapper)", () => {
    const card = {
      $type: "Card",
      title: "Inbox",
      children: [{ $type: "Fact", label: "From", value: "Pat" }],
    };
    expect(runPresent({ raw: JSON.stringify(card) })).toEqual({
      ok: true,
      $type: "Card",
      preview: "Inbox",
    });
    expect(runPresent({ raw: card })).toEqual({
      ok: true,
      $type: "Card",
      preview: "Inbox",
    });
  });

  it("accepts type as an alias for $type", () => {
    expect(
      runPresent({
        type: "Card",
        title: "Inbox",
        children: [{ type: "Fact", label: "Unread", value: "201" }],
      }),
    ).toEqual({
      ok: true,
      $type: "Card",
      preview: "Inbox",
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

  it("treats a skill File as knowledge when place is omitted", () => {
    expect(
      sanitizePresentTree({
        $type: "File",
        path: "skills/sinemart-receipt-fraud-review/SKILL.md",
      }),
    ).toMatchObject({
      $type: "File",
      path: "skills/sinemart-receipt-fraud-review/SKILL.md",
      place: "knowledge",
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

describe("PRESENT_TOOL_PARAMETERS", () => {
  it("stays shallow so wrapped trees still reach execute", () => {
    expect(PRESENT_TOOL_PARAMETERS.required).toBeUndefined();
    expect(PRESENT_TOOL_PARAMETERS.additionalProperties).toBe(true);
    expect(PRESENT_TOOL_PARAMETERS.properties.$type.type).toBe("string");
    expect(PRESENT_TOOL_PARAMETERS.properties.children.items).toEqual({
      type: "object",
      additionalProperties: true,
    });
  });
});
