import { describe, expect, it } from "vitest";
import {
  knowledgeLinkTarget,
  knowledgeMarkdownUrl,
  parseKnowledgeHref,
  rewriteKnowledgeHrefs,
} from "./knowledge-link";

const FILES = [
  "for/example/this-file.md",
  "how-we-work/constraints.md",
  "playbooks/weekly-update/SKILL.md",
];

describe("parseKnowledgeHref", () => {
  it("treats office paths as root paths from any nested file", () => {
    expect(parseKnowledgeHref("how-we-work/constraints.md")).toEqual({
      kind: "path",
      path: "how-we-work/constraints.md",
    });
    expect(parseKnowledgeHref("/how-we-work/constraints.md")).toEqual({
      kind: "path",
      path: "how-we-work/constraints.md",
    });
    expect(parseKnowledgeHref("how-we-work/constraints.md#voice")).toEqual({
      kind: "path",
      path: "how-we-work/constraints.md",
    });
  });

  it("rejects ../ and other schemes", () => {
    expect(parseKnowledgeHref("../how-we-work/constraints.md")).toEqual({
      kind: "invalid",
    });
    expect(parseKnowledgeHref("../../secret.md")).toEqual({ kind: "invalid" });
    expect(parseKnowledgeHref("javascript:alert(1)")).toEqual({
      kind: "invalid",
    });
    expect(parseKnowledgeHref("[[constraints]]")).toEqual({ kind: "invalid" });
  });

  it("keeps http and mailto", () => {
    expect(parseKnowledgeHref("https://example.com/a")).toEqual({
      kind: "external",
      href: "https://example.com/a",
    });
    expect(parseKnowledgeHref("mailto:a@b.co")).toEqual({
      kind: "external",
      href: "mailto:a@b.co",
    });
  });
});

describe("knowledgeMarkdownUrl", () => {
  it("passes office paths through for the preview", () => {
    expect(knowledgeMarkdownUrl("how-we-work/constraints.md")).toBe(
      "/how-we-work/constraints.md",
    );
    expect(knowledgeMarkdownUrl("../secret.md")).toBeNull();
  });
});

describe("rewriteKnowledgeHrefs", () => {
  it("prefixes office paths so harden keeps them", () => {
    const tree = {
      children: [
        {
          tagName: "a",
          properties: { href: "how-we-work/constraints.md" },
          children: [],
        },
        {
          tagName: "a",
          properties: { href: "https://example.com" },
          children: [],
        },
      ],
    };
    rewriteKnowledgeHrefs()(tree);
    expect(tree.children[0]?.properties.href).toBe(
      "/how-we-work/constraints.md",
    );
    expect(tree.children[1]?.properties.href).toBe("https://example.com");
  });
});

describe("knowledgeLinkTarget", () => {
  it("finds files and implied folders", () => {
    expect(knowledgeLinkTarget("how-we-work/constraints.md", FILES)).toBe(
      "file",
    );
    expect(knowledgeLinkTarget("how-we-work", FILES)).toBe("folder");
    expect(knowledgeLinkTarget("missing.md", FILES)).toBeNull();
  });
});
