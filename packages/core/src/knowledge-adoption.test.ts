import { describe, expect, it } from "vitest";
import {
  adoptionHeatLevel,
  adoptionHeatmap,
  buildAdoption,
} from "./knowledge-adoption.js";

describe("buildAdoption", () => {
  it("attributes tasks to the human who asked, not the bot", () => {
    const snapshot = buildAdoption(
      [
        {
          triggeredBy: "usr_ada",
          triggeredByName: "Ada",
          triggeredAt: "2026-09-11T18:00:00.000Z",
          activity: [
            {
              at: "2026-09-12T03:05:00.000Z",
              author: "Ada",
              authorId: "usr_ada",
            },
            {
              at: "2026-09-12T04:00:00.000Z",
              author: "piper",
            },
          ],
        },
        {
          triggeredBy: "usr_sam",
          triggeredByName: "Sam",
          triggeredAt: "2026-09-10T12:00:00.000Z",
        },
      ],
      [
        { userId: "usr_ada", name: "Ada", image: "https://office/ada.png" },
        { userId: "usr_sam", name: "Sam", image: null },
      ],
    );
    expect(snapshot.people.map((row) => row.userId)).toEqual([
      "usr_ada",
      "usr_sam",
    ]);
    expect(snapshot.people[0]).toMatchObject({
      name: "Ada",
      image: "https://office/ada.png",
      taskCount: 1,
      contributionCount: 3,
    });
    expect(snapshot.people[1]).toMatchObject({
      name: "Sam",
      taskCount: 1,
      contributionCount: 1,
    });
    expect(snapshot.days.get("2026-09-12")).toBe(2);
    expect(snapshot.days.get("2026-09-11")).toBe(1);
    expect(snapshot.people.some((row) => row.name === "piper")).toBe(false);
  });

  it("still shows teammates with no tasks", () => {
    const snapshot = buildAdoption(
      [],
      [
        { userId: "usr_ada", name: "Ada" },
        { userId: "usr_sam", name: "Sam" },
      ],
    );
    expect(snapshot.people.map((row) => row.name).sort()).toEqual([
      "Ada",
      "Sam",
    ]);
    expect(snapshot.people.every((row) => row.taskCount === 0)).toBe(true);
  });
});

describe("adoptionHeatmap", () => {
  it("lays out a Sunday-start GitHub-style calendar", () => {
    const counts = new Map([["2026-09-11", 2]]);
    const { weeks, months } = adoptionHeatmap(
      counts,
      new Date("2026-09-12T12:00:00.000Z"),
      4,
    );
    expect(weeks).toHaveLength(4);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[0]?.[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(weeks.at(-1)?.[5]).toMatchObject({
      date: "2026-09-11",
      count: 2,
      future: false,
    });
    expect(weeks.at(-1)?.[6]).toMatchObject({
      date: "2026-09-12",
      count: 0,
      future: false,
    });
    expect(months.some((row) => row.label === "Sep")).toBe(true);
  });

  it("ramps heat from empty to busy", () => {
    expect(adoptionHeatLevel(0)).toBe(0);
    expect(adoptionHeatLevel(1)).toBe(1);
    expect(adoptionHeatLevel(3)).toBe(2);
    expect(adoptionHeatLevel(6)).toBe(3);
    expect(adoptionHeatLevel(7)).toBe(4);
  });
});
