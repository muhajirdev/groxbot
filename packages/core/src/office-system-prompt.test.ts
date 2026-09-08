import { describe, expect, it } from "vitest";
import { OFFICE_CODE_TOOL_NAME } from "./execute-imports.js";
import { SKILL_TOOL_NAME } from "./office-skill.js";
import {
  buildOfficeSystemPrompt,
  OFFICE_SET_CONTEXT_TOOL_NAME,
  officeCanReadSkills,
  officeMcpGuideline,
  officePluginsGuideline,
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

  it("tells the teammate /learn authors a skill", () => {
    const prompt = buildOfficeSystemPrompt({
      identity,
      tools: [{ name: SKILL_TOOL_NAME }],
    });
    expect(prompt).toMatch(/\/learn a source or workflow authors one/);
    expect(prompt).toMatch(/\/skill:name loads it for this turn/);
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

  it("names workspace MCP inside code when the sandbox is on this turn", () => {
    const prompt = buildOfficeSystemPrompt({
      identity,
      tools: [{ name: OFFICE_CODE_TOOL_NAME }],
      mcp: ["mimpimu"],
    });
    expect(prompt).toMatch(/workspace MCP/);
    expect(prompt).toContain(officeMcpGuideline(["mimpimu"]));
    expect(prompt).toMatch(/codemode\.describe\("mimpimu\.<method>"\)/);
    expect(prompt).not.toMatch(/codemode\.describe\("mimpimu"\)/);
    expect(prompt).toMatch(/do not `codemode\.search` for it/);
    expect(prompt).toMatch(/compact projection/);
    expect(prompt).toMatch(/counts and groups/);
  });

  it("names connected plugins inside code when the sandbox is on this turn", () => {
    const prompt = buildOfficeSystemPrompt({
      identity,
      tools: [{ name: OFFICE_CODE_TOOL_NAME }],
      plugins: ["gmail", "github"],
    });
    expect(prompt).toMatch(/and plugins/);
    expect(prompt).toContain(officePluginsGuideline(["gmail", "github"]));
    expect(prompt).toMatch(/plugins\.search\(\{ query: "gmail" \}\)/);
    expect(prompt).not.toMatch(/GMAIL_FETCH_EMAILS/);
    expect(prompt).toMatch(/plugins\.execute\(\{ slug, arguments \}\)/);
    expect(prompt).toMatch(/not a sentence/);
    expect(prompt).toMatch(/compact projection/);
  });

  it("uses the connected toolkit as the search example, not a hardcoded app", () => {
    const prompt = buildOfficeSystemPrompt({
      identity,
      tools: [{ name: OFFICE_CODE_TOOL_NAME }],
      plugins: ["slack"],
    });
    expect(prompt).toContain(officePluginsGuideline(["slack"]));
    expect(prompt).toMatch(/plugins\.search\(\{ query: "slack" \}\)/);
    expect(prompt).not.toMatch(/GMAIL_FETCH_EMAILS/);
    expect(prompt).not.toMatch(/gmail/i);
  });

  it("omits plugins on the intro turn", () => {
    const prompt = buildOfficeSystemPrompt({
      identity,
      tools: [{ name: OFFICE_SET_CONTEXT_TOOL_NAME }],
      plugins: ["gmail"],
    });
    expect(prompt).not.toMatch(/gmail/);
    expect(prompt).not.toMatch(/plugins\.search/);
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

  it("tells computer tools that inbox is not under /workspace", () => {
    const prompt = buildOfficeSystemPrompt({
      identity,
      tools: [
        { name: "read" },
        { name: "list" },
        { name: "to_markdown" },
      ],
    });
    expect(prompt).toMatch(/inbox is not under \/workspace/);
    expect(prompt).toMatch(/to_markdown, not read/);
    expect(prompt).toMatch(/omit empty html/);
    expect(prompt).toMatch(/read again with offset/);
    expect(prompt).toMatch(/\.tool-output/);
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
