import { describe, expect, it } from "vitest";
import { matchOfficeSkills, officeSkills } from "./knowledge-tree";

describe("officeSkills", () => {
  it("reads SKILL.md playbooks from the library tree", () => {
    expect(
      officeSkills([
        {
          path: "digest/SKILL.md",
          name: "SKILL.md",
          title: "Weekly digest",
          description: "Summarize the week.",
          encoding: "text",
          mediaType: "text/markdown",
        },
      ]),
    ).toEqual([{ name: "digest", description: "Summarize the week." }]);
  });
});

describe("matchOfficeSkills", () => {
  const skills = [{ name: "digest", description: "Summarize the week." }];
  it("filters a slash query", () => {
    expect(matchOfficeSkills("/di", skills)).toEqual(skills);
    expect(matchOfficeSkills("digest", skills)).toEqual([]);
    expect(matchOfficeSkills("/nope", skills)).toEqual([]);
  });
});
