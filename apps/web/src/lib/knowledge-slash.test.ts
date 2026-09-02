import { describe, expect, it } from "vitest";
import { matchOfficeSkills } from "./knowledge-slash";

const skills = [
  { name: "weekly-update", description: "Five-bullet Monday." },
  { name: "outbound-first-touch", description: "One screen, no pitch." },
];

describe("matchOfficeSkills", () => {
  it("is idle until the composer starts with a slash", () => {
    expect(matchOfficeSkills("weekly", skills)).toEqual([]);
  });

  it("lists all office skills for a bare slash", () => {
    expect(matchOfficeSkills("/", skills)).toEqual(skills);
  });

  it("filters by name", () => {
    expect(matchOfficeSkills("/week", skills).map((row) => row.name)).toEqual([
      "weekly-update",
    ]);
  });

  it("hides once the composer has more than a slash token", () => {
    expect(matchOfficeSkills("/weekly-update please", skills)).toEqual([]);
  });
});
