import { describe, expect, it } from "vitest";
import { matchOfficeLearn, matchOfficeSkills } from "./knowledge-slash";

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

  it("lists all office skills for /skill:", () => {
    expect(matchOfficeSkills("/skill:", skills)).toEqual(skills);
  });

  it("filters by name after /skill:", () => {
    expect(
      matchOfficeSkills("/skill:week", skills).map((row) => row.name),
    ).toEqual(["weekly-update"]);
  });

  it("hides once the composer has more than a slash token", () => {
    expect(matchOfficeSkills("/weekly-update please", skills)).toEqual([]);
  });
});

describe("matchOfficeLearn", () => {
  it("offers /learn on a bare slash and /le", () => {
    expect(matchOfficeLearn("/")).toBe(true);
    expect(matchOfficeLearn("/le")).toBe(true);
    expect(matchOfficeLearn("/learn")).toBe(true);
  });

  it("hides once a topic or a skill token is underway", () => {
    expect(matchOfficeLearn("/learn the docs")).toBe(false);
    expect(matchOfficeLearn("/skill:week")).toBe(false);
    expect(matchOfficeLearn("/weekly")).toBe(false);
    expect(matchOfficeLearn("learn")).toBe(false);
  });
});
