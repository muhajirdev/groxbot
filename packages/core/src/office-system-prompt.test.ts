import { describe, expect, it } from "vitest";
import { OFFICE_CODE_TOOL_NAME } from "./execute-imports.js";
import {
  buildOfficeSystemPrompt,
  officeCanReadSkills,
  OFFICE_SET_CONTEXT_TOOL_NAME,
} from "./office-system-prompt.js";

describe("buildOfficeSystemPrompt", () => {
  const identity = "You are Reja, a Groxbot teammate in this office thread.";

  it("lists only the tools on this turn", () => {
    const prompt = buildOfficeSystemPrompt({
      identity,
      tools: [
        { name: OFFICE_SET_CONTEXT_TOOL_NAME },
        { name: OFFICE_CODE_TOOL_NAME },
      ],
    });
    expect(prompt.startsWith(identity)).toBe(true);
    expect(prompt).toMatch(/Available tools:/);
    expect(prompt).toMatch(/- set_context:/);
    expect(prompt).toMatch(/- code:/);
    expect(prompt).not.toMatch(/- shell:/);
    expect(prompt).not.toMatch(/- present:/);
    expect(prompt).toMatch(/Call set_context as a top-level tool/);
    expect(prompt).toMatch(/not a global inside code/);
    expect(prompt).toMatch(/knowledge, routines, and history live inside code/);
    expect(prompt).toMatch(/When you write a knowledge file/);
    expect(prompt).toMatch(/\[label\]\(path\/from\/office\/root\.md\)/);
    expect(prompt).not.toMatch(/This turn only has set_context/);
  });

  it("omits a tool that is not in the catalog", () => {
    const prompt = buildOfficeSystemPrompt({
      identity,
      tools: [{ name: OFFICE_SET_CONTEXT_TOOL_NAME }],
    });
    expect(prompt).toMatch(/- set_context:/);
    expect(prompt).not.toMatch(/- code:/);
    expect(prompt).not.toMatch(/inside code: `await knowledge/);
    expect(prompt).not.toMatch(/When you write a knowledge file/);
    expect(prompt).toMatch(/This turn only has set_context/);
    expect(prompt).toMatch(/ask if they want a role, personality/);
    expect(prompt).toMatch(/Do not write the overlay as chat text/);
  });

  it("shows (none) when the catalog is empty", () => {
    const prompt = buildOfficeSystemPrompt({ identity, tools: [] });
    expect(prompt).toMatch(/Available tools:\n\(none\)/);
    expect(prompt).not.toMatch(/- set_context:/);
  });

  it("falls back to the first sentence of an unknown tool description", () => {
    const prompt = buildOfficeSystemPrompt({
      identity,
      tools: [
        {
          name: "calendar_list",
          description: "List upcoming events. Paginate with cursor.",
        },
      ],
    });
    expect(prompt).toMatch(/- calendar_list: List upcoming events\./);
    expect(prompt).not.toMatch(/Paginate with cursor/);
  });
});

describe("officeCanReadSkills", () => {
  it("needs the code sandbox to load SKILL.md", () => {
    expect(officeCanReadSkills([{ name: OFFICE_SET_CONTEXT_TOOL_NAME }])).toBe(
      false,
    );
    expect(officeCanReadSkills([{ name: OFFICE_CODE_TOOL_NAME }])).toBe(true);
  });
});
