import { describe, expect, it } from "vitest";
import {
  knowledgeSearchStatus,
  matchOfficeLearn,
  matchOfficeSkills,
  officeSkills,
} from "./knowledge-tree";

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

describe("knowledgeSearchStatus", () => {
  it("says when notes are ranking, and when it fell back to names", () => {
    expect(
      knowledgeSearchStatus({
        query: "standup",
        fetching: true,
        hitCount: 0,
        fallbackCount: 2,
      }),
    ).toEqual({ label: "Searching notes…", busy: true });
    expect(
      knowledgeSearchStatus({
        query: "standup",
        fetching: false,
        hitCount: 3,
        fallbackCount: 0,
      }),
    ).toEqual({ label: "3 notes", busy: false });
    expect(
      knowledgeSearchStatus({
        query: "standup",
        fetching: false,
        hitCount: 0,
        fallbackCount: 2,
      }),
    ).toEqual({ label: "Matching names", busy: false });
  });
});

describe("matchOfficeLearn", () => {
  it("offers /learn on a bare slash", () => {
    expect(matchOfficeLearn("/")).toBe(true);
    expect(matchOfficeLearn("/learn")).toBe(true);
    expect(matchOfficeLearn("/learn the docs")).toBe(false);
  });
});
