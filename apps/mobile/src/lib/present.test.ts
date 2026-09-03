import { describe, expect, it } from "vitest";
import {
  presentChart,
  presentFileOpen,
  presentFilePlace,
  presentFileTitle,
  presentImageSrc,
  presentTable,
} from "./present";

describe("presentFileOpen", () => {
  it("opens a computer path on this bot", () => {
    expect(presentFileOpen("bot_1", "notes/q3.md", "computer")).toEqual({
      screen: "Computer",
      botId: "bot_1",
      path: "notes/q3.md",
    });
  });

  it("opens a knowledge path in the library", () => {
    expect(presentFileOpen("bot_1", "skills/q3/SKILL.md", "knowledge")).toEqual(
      {
        screen: "Knowledge",
        path: "skills/q3/SKILL.md",
      },
    );
  });
});

describe("presentFileTitle", () => {
  it("prefers an explicit title", () => {
    expect(
      presentFileTitle({
        $type: "File",
        path: "notes/q3.md",
        title: "Q3 notes",
      }),
    ).toBe("Q3 notes");
  });

  it("falls back to the basename", () => {
    expect(presentFileTitle({ $type: "File", path: "notes/q3.md" })).toBe(
      "q3.md",
    );
  });
});

describe("presentFilePlace", () => {
  it("defaults to computer", () => {
    expect(presentFilePlace(undefined)).toBe("computer");
    expect(presentFilePlace("knowledge")).toBe("knowledge");
  });
});

describe("presentImageSrc", () => {
  it("keeps https and drops javascript", () => {
    expect(presentImageSrc("https://example.com/chart.png")).toBe(
      "https://example.com/chart.png",
    );
    expect(presentImageSrc("javascript:alert(1)")).toBeNull();
  });
});

describe("presentTable", () => {
  it("reads column labels and row cells", () => {
    expect(
      presentTable({
        $type: "Table",
        columns: [{ label: "Name" }, { label: "Role" }],
        rows: [
          ["Piper", "Product"],
          ["Reja", "Chief of Staff"],
        ],
      }),
    ).toEqual({
      columns: ["Name", "Role"],
      rows: [
        ["Piper", "Product"],
        ["Reja", "Chief of Staff"],
      ],
    });
  });
});

describe("presentChart", () => {
  it("reads a single series of points", () => {
    expect(
      presentChart({
        $type: "Chart",
        variant: "bar",
        data: [
          { label: "Q1", value: 10 },
          { label: "Q2", value: 20 },
        ],
      }),
    ).toEqual({
      variant: "bar",
      points: [
        { label: "Q1", value: 10 },
        { label: "Q2", value: 20 },
      ],
    });
  });

  it("prefers the first named series", () => {
    expect(
      presentChart({
        $type: "Chart",
        variant: "line",
        series: [{ label: "Bookings", data: [{ label: "Q3", value: 12 }] }],
        data: [{ label: "ignored", value: 1 }],
      }),
    ).toEqual({
      variant: "line",
      points: [{ label: "Q3", value: 12 }],
    });
  });
});
