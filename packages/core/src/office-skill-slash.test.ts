import { describe, expect, it } from "vitest";
import {
  catalogHasSkill,
  lastUserText,
  officeSkillSlashTurn,
  parseOfficeSkillSlash,
  withOfficeSkillSlashHint,
} from "./office-skill-slash.js";

describe("parseOfficeSkillSlash", () => {
  it("reads a bare skill command", () => {
    expect(parseOfficeSkillSlash("/agreements")).toEqual({
      name: "agreements",
      input: "",
    });
  });

  it("keeps arguments after the command", () => {
    expect(parseOfficeSkillSlash("/agreements Acme, 12 months")).toEqual({
      name: "agreements",
      input: "Acme, 12 months",
    });
  });

  it("ignores ordinary chat and incomplete slashes", () => {
    expect(parseOfficeSkillSlash("agreements")).toBeNull();
    expect(parseOfficeSkillSlash("/")).toBeNull();
    expect(parseOfficeSkillSlash("please /agreements")).toBeNull();
  });
});

describe("lastUserText", () => {
  it("reads the latest user string or text parts", () => {
    expect(
      lastUserText([
        { role: "user", content: "older" },
        { role: "assistant", content: "ok" },
        { role: "user", content: [{ type: "text", text: "/agreements" }] },
      ]),
    ).toBe("/agreements");
  });

  it("reads UIMessage parts when content is missing", () => {
    expect(
      lastUserText([
        {
          role: "user",
          parts: [{ type: "text", text: "/weekly-update" }],
        },
      ]),
    ).toBe("/weekly-update");
  });
});

describe("catalogHasSkill", () => {
  const catalog = [
    "Available skills. When a task matches a skill, use activate_skill with its name before proceeding.",
    "",
    "- agreements: Draft Expandra client agreement documents.",
    "- weekly-update: Five-bullet Monday.",
  ].join("\n");

  it("matches skill catalog bullets", () => {
    expect(catalogHasSkill(catalog, "agreements")).toBe(true);
    expect(catalogHasSkill(catalog, "missing")).toBe(false);
  });
});

describe("withOfficeSkillSlashHint", () => {
  it("tells the model to activate that skill first", () => {
    const next = withOfficeSkillSlashHint("You are Reja.", {
      name: "agreements",
      input: "",
    });
    expect(next).toContain("You are Reja.");
    expect(next).toContain('Call activate_skill with name "agreements"');
    expect(next).not.toMatch(/Remaining text/);
  });

  it("does not duplicate the hint", () => {
    const once = withOfficeSkillSlashHint("You are Reja.", {
      name: "agreements",
      input: "Acme",
    });
    expect(
      withOfficeSkillSlashHint(once, { name: "agreements", input: "Acme" }),
    ).toBe(once);
  });
});

describe("officeSkillSlashTurn", () => {
  const system = [
    "You are Reja.",
    "",
    "- agreements: Draft Expandra client agreement documents.",
  ].join("\n");
  const messages = [{ role: "user", content: "/agreements" }];

  it("forces activate_skill for a cataloged slash command", () => {
    const next = officeSkillSlashTurn({
      system,
      messages,
      hasActivateSkill: true,
    });
    expect(next.forceActivate).toBe(true);
    expect(next.system).toContain('Call activate_skill with name "agreements"');
  });

  it("does not force when the catalog does not list that skill", () => {
    expect(
      officeSkillSlashTurn({
        system: "You are Reja.",
        messages,
        hasActivateSkill: true,
      }).forceActivate,
    ).toBe(false);
  });

  it("does not force on continuations", () => {
    expect(
      officeSkillSlashTurn({
        system,
        messages,
        hasActivateSkill: true,
        continuation: true,
      }).forceActivate,
    ).toBe(false);
  });

  it("hints knowledge.read when activate_skill is gone", () => {
    const next = officeSkillSlashTurn({
      system: "You are Reja.",
      messages,
      hasActivateSkill: false,
    });
    expect(next.forceActivate).toBe(false);
    expect(next.system).toContain("knowledge.read");
    expect(next.system).toContain("skills/agreements/SKILL.md");
    expect(next.system).not.toContain("activate_skill");
  });
});
