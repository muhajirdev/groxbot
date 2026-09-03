import { describe, expect, it } from "vitest";
import {
  knowledgeLinkTarget,
  knowledgeMarkdownUrl,
  parseKnowledgeHref,
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
    expect(parseKnowledgeHref("../secret.md")).toEqual({ kind: "invalid" });
    expect(parseKnowledgeHref("https://example.com/a")).toEqual({
      kind: "external",
      href: "https://example.com/a",
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

describe("knowledgeLinkTarget", () => {
  it("finds files and implied folders", () => {
    expect(knowledgeLinkTarget("how-we-work/constraints.md", FILES)).toBe(
      "file",
    );
    expect(knowledgeLinkTarget("how-we-work", FILES)).toBe("folder");
    expect(knowledgeLinkTarget("missing.md", FILES)).toBeNull();
  });
});
