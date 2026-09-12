import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KNOW_GRAPH } from "../lib/copy";
import { KnowGraph } from "./KnowGraph";

describe("KnowGraph", () => {
  it("renders an Obsidian-style map of the shared files", () => {
    const html = renderToStaticMarkup(createElement(KnowGraph));

    expect(html).toContain("know-graph");
    expect(html).toContain("<svg");
    expect(html).toContain("voice.md");
    expect(html).toContain("SKILL.md");
    expect(html).toContain("<line");
    expect(KNOW_GRAPH.edges.length).toBeGreaterThan(6);
    expect(KNOW_GRAPH.nodes.some((node) => "hot" in node && node.hot)).toBe(
      true,
    );
  });
});
