import { describe, expect, it } from "vitest";
import type { OfficeSkillCatalogEntry } from "./office-skill.js";
import {
  applyOfficeSkillsToSystem,
  formatAvailableSkillsXml,
  lastUserText,
  parseOfficeSkillSlash,
  withForcedSkillContent,
  withOfficeSkillCatalog,
} from "./office-skill-slash.js";

const skill: OfficeSkillCatalogEntry = {
  name: "agreements",
  description: "Draft client agreements.",
  path: "skills/agreements/SKILL.md",
  directory: "skills/agreements",
  body: "Ask for the term. Cite the template.",
};

describe("parseOfficeSkillSlash", () => {
  it("reads Pi /skill:name", () => {
    expect(parseOfficeSkillSlash("/skill:agreements")).toEqual({
      name: "agreements",
      input: "",
    });
    expect(parseOfficeSkillSlash("/skill:agreements Acme, 12 months")).toEqual({
      name: "agreements",
      input: "Acme, 12 months",
    });
  });

  it("still reads a bare /name from the composer", () => {
    expect(parseOfficeSkillSlash("/agreements")).toEqual({
      name: "agreements",
      input: "",
    });
  });

  it("ignores ordinary chat and /skill without a name", () => {
    expect(parseOfficeSkillSlash("agreements")).toBeNull();
    expect(parseOfficeSkillSlash("/")).toBeNull();
    expect(parseOfficeSkillSlash("/skill")).toBeNull();
    expect(parseOfficeSkillSlash("please /agreements")).toBeNull();
  });
});

describe("lastUserText", () => {
  it("reads the latest user string or text parts", () => {
    expect(
      lastUserText([
        { role: "user", content: "older" },
        { role: "assistant", content: "ok" },
        { role: "user", content: [{ type: "text", text: "/skill:agreements" }] },
      ]),
    ).toBe("/skill:agreements");
  });
});

describe("skill catalog", () => {
  it("omits the XML block when there are no skills", () => {
    expect(formatAvailableSkillsXml([])).toBe("");
    expect(withOfficeSkillCatalog("You are Reja.", [])).toBe("You are Reja.");
  });

  it("lists name, description, and office path", () => {
    const xml = formatAvailableSkillsXml([skill]);
    expect(xml).toContain("<available_skills>");
    expect(xml).toContain("<name>agreements</name>");
    expect(xml).toContain("<description>Draft client agreements.</description>");
    expect(xml).toContain("<location>skills/agreements/SKILL.md</location>");
    expect(xml).not.toContain("Ask for the term");
  });

  it("tells the model to knowledge.read, not activate_skill", () => {
    const next = withOfficeSkillCatalog("You are Reja.", [skill]);
    expect(next).toContain("knowledge.read");
    expect(next).not.toContain("activate_skill");
  });
});

describe("forced /skill:name content", () => {
  it("injects the body and User args", () => {
    const next = withForcedSkillContent("You are Reja.", skill, "Acme");
    expect(next).toContain("<skill_content name=\"agreements\">");
    expect(next).toContain("Ask for the term. Cite the template.");
    expect(next).toContain("Skill directory: skills/agreements");
    expect(next).toContain("User: Acme");
    expect(next).not.toContain("activate_skill");
  });
});

describe("applyOfficeSkillsToSystem", () => {
  it("injects a cataloged /skill:name", () => {
    const next = applyOfficeSkillsToSystem({
      system: "You are Reja.",
      messages: [{ role: "user", content: "/skill:agreements Acme" }],
      catalog: [skill],
    });
    expect(next).toContain("<available_skills>");
    expect(next).toContain("<skill_content name=\"agreements\">");
    expect(next).toContain("User: Acme");
  });

  it("does not inject an unknown slash", () => {
    const next = applyOfficeSkillsToSystem({
      system: "You are Reja.",
      messages: [{ role: "user", content: "/skill:missing" }],
      catalog: [skill],
    });
    expect(next).toContain("<available_skills>");
    expect(next).not.toContain("<skill_content");
  });

  it("does not inject on continuations", () => {
    const next = applyOfficeSkillsToSystem({
      system: "You are Reja.",
      messages: [{ role: "user", content: "/skill:agreements" }],
      catalog: [skill],
      continuation: true,
    });
    expect(next).toContain("<available_skills>");
    expect(next).not.toContain("<skill_content");
  });
});
