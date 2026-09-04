import { describe, expect, it } from "vitest";
import {
  mcpExecuteHint,
  OFFICE_CODE_TOOL_PREAMBLE,
  teammatePrompt,
  withOfficeExecuteDescription,
} from "./run-continue.js";
import { assertTransition, canTransition } from "./run-state.js";

describe("run-state", () => {
  it("allows queued to leased", () => {
    expect(canTransition("queued", "leased")).toBe(true);
  });

  it("rejects completed to running", () => {
    expect(canTransition("completed", "running")).toBe(false);
    expect(() => assertTransition("completed", "running")).toThrow(/Illegal/);
  });
});

describe("teammatePrompt", () => {
  it("names the bot as a Groxbot teammate", () => {
    const prompt = teammatePrompt({
      name: "Reja",
      modelLabel: "Kimi K2.6",
    });
    expect(prompt).toMatch(/You are Reja, a Groxbot teammate/);
    expect(prompt).not.toMatch(/Chief of Staff/);
    expect(prompt).toMatch(/This thread is your desk/);
    expect(prompt).toMatch(/inbox\//);
    expect(prompt).toMatch(/Keep each reply short/);
    expect(prompt).toMatch(/sender's name/);
    expect(prompt).toMatch(/Markdown is fine/);
    expect(prompt).not.toMatch(/Keep the week moving/);
    expect(prompt).not.toMatch(/Ask before sending mail/);
    expect(prompt).not.toMatch(/Do the work with tools/);
    expect(prompt).not.toMatch(/inside execute/);
    expect(prompt).not.toMatch(/inside code/);
    expect(prompt).not.toMatch(/web_search/);
    expect(prompt).not.toMatch(/set_context on soul/);
    expect(prompt).not.toMatch(/Available tools:/);
    expect(prompt).toMatch(/If asked which model you use, say Kimi K2\.6/);
    expect(prompt).not.toMatch(/Think agent/);
  });
});

describe("withOfficeExecuteDescription", () => {
  const generated = [
    "Execute JavaScript in a sandbox with access to connector SDKs.",
    "",
    "## Available connectors",
    "",
    "- `tools` — page helpers.",
    "- `knowledge`",
    "- `history`",
    "- `routines`",
    "- `github`",
  ].join("\n");

  it("hints knowledge on a bare connector bullet", () => {
    const next = withOfficeExecuteDescription(generated, true);
    expect(next).toMatch(/- `knowledge` — shared office library/);
    expect(next).toMatch(/When you write a knowledge file/);
    expect(next).toMatch(/\[label\]\(path\/from\/office\/root\.md\)/);
    expect(next).not.toMatch(/state\.\*/);
    expect(next).toMatch(/knowledge\.search\(\{ query \}\)/);
    expect(next).toContain("- `github`");
    expect(next).toContain("- `routines`");
    expect(next).not.toMatch(/^- `knowledge`$/m);
  });

  it("hints routines so the bot can schedule work", () => {
    const next = withOfficeExecuteDescription(generated, false, {
      routines: true,
    });
    expect(next).toMatch(/- `routines` — this bot’s recurring jobs/);
    expect(next).toMatch(/routines\.list\(\)/);
    expect(next).toContain("- `knowledge`");
    expect(next).not.toMatch(/^- `routines`$/m);
  });

  it("hints history so the bot can search this thread", () => {
    const next = withOfficeExecuteDescription(generated, false, {
      history: true,
    });
    expect(next).toMatch(/- `history` — this office thread/);
    expect(next).toMatch(/history\.search\(\{ query \}\)/);
    expect(next).not.toMatch(/^- `history`$/m);
  });

  it("does not duplicate an existing hint", () => {
    const once = withOfficeExecuteDescription(generated, true);
    expect(withOfficeExecuteDescription(once, true)).toBe(once);
  });

  it("prefixes a contrast with the computer shell", () => {
    const next = withOfficeExecuteDescription(generated, false);
    expect(next.startsWith(OFFICE_CODE_TOOL_PREAMBLE)).toBe(true);
    expect(next).toMatch(/not globals here/);
    expect(next).toContain(generated);
  });

  it("hints named office MCP connectors so search is not required to notice them", () => {
    const next = withOfficeExecuteDescription(generated, false, {
      mcp: ["mimpimu"],
    });
    expect(next).toContain(mcpExecuteHint("mimpimu"));
    expect(next).toMatch(/codemode\.describe\("mimpimu\.<method>"\)/);
    expect(next).not.toMatch(/codemode\.describe\("mimpimu"\)/);
    expect(next).not.toMatch(/^- `mimpimu`$/m);
  });
});
