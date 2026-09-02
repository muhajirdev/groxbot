import { describe, expect, it } from "vitest";
import {
  THINK_RUNTIME_LINE,
  TEAMMATE_RUNTIME_LINE,
  rewriteThinkCapability,
  teammatePrompt,
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
  it("names the bot and the job as a Groxbot teammate", () => {
    const prompt = teammatePrompt({
      name: "Reja",
      title: "Chief of Staff",
      description: "Keep the week moving.",
      instructions: "Ask before sending mail.",
      modelLabel: "Kimi K2.6",
    });
    expect(prompt).toMatch(/You are Reja, Chief of Staff, a Groxbot teammate/);
    expect(prompt).toMatch(/This thread is your desk/);
    expect(prompt).toMatch(/inbox\//);
    expect(prompt).toMatch(/import npm packages/);
    expect(prompt).toMatch(/fetch_url/);
    expect(prompt).toMatch(/to_markdown/);
    expect(prompt).toMatch(/Keep each reply short/);
    expect(prompt).toMatch(/sender's name/);
    expect(prompt).toMatch(/Do the work with tools/);
    expect(prompt).toMatch(/Markdown is fine/);
    expect(prompt).toMatch(/Learn as you go/);
    expect(prompt).toMatch(/set_context on memory/);
    expect(prompt).toMatch(/set_context on soul/);
    expect(prompt).toMatch(/Keep your name/);
    expect(prompt).not.toMatch(/Do not change who you are/);
    expect(prompt).toMatch(/memory\.md/);
    expect(prompt).toMatch(/knowledge\.search/);
    expect(prompt).toMatch(/knowledge\.write/);
    expect(prompt).toMatch(/skills\/<name>\/SKILL\.md/);
    expect(prompt).toMatch(/how-we-work\/constraints\.md/);
    expect(prompt).toMatch(/not \[\[wikilinks\]\]/);
    expect(prompt).toMatch(/If asked which model you use, say Kimi K2\.6/);
    expect(prompt).not.toMatch(/Think agent/);
  });
});

describe("rewriteThinkCapability", () => {
  it("replaces Think's runtime identity and keeps the tool list", () => {
    const next = rewriteThinkCapability(
      "You are Reja.\n\nYou are running inside a Think agent.\n\nCapabilities available in this turn:\n- Use the tools",
    );
    expect(next).toContain(TEAMMATE_RUNTIME_LINE);
    expect(next).toContain("Capabilities available in this turn:");
    expect(next).not.toContain(THINK_RUNTIME_LINE);
  });

  it("leaves other system prompts unchanged", () => {
    expect(rewriteThinkCapability("You are Reja.")).toBe("You are Reja.");
  });
});
