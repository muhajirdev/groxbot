import { describe, expect, it } from "vitest";
import {
  dropKnowledgeLinkPrefix,
  dropKnowledgeLinkSource,
  emptyKnowledgeLinkSnapshot,
  extractOfficeMarkdownPaths,
  isKnowledgeLinksPath,
  KNOWLEDGE_MARKDOWN_LINK_HINT,
  knowledgeBacklinks,
  parseKnowledgeLinkSnapshot,
  parseOfficeMarkdownHref,
  setKnowledgeLinkSource,
} from "./knowledge-links.js";

describe("parseOfficeMarkdownHref", () => {
  it("uses office-root paths", () => {
    expect(parseOfficeMarkdownHref("how-we-work/constraints.md")).toBe(
      "how-we-work/constraints.md",
    );
    expect(parseOfficeMarkdownHref("/how-we-work/constraints.md")).toBe(
      "how-we-work/constraints.md",
    );
    expect(parseOfficeMarkdownHref("../secret.md")).toBeNull();
    expect(parseOfficeMarkdownHref("https://example.com")).toBeNull();
  });
});

describe("extractOfficeMarkdownPaths", () => {
  it("picks office markdown links and skips images, fences, and wiki text", () => {
    const body = [
      "See [constraints](how-we-work/constraints.md) and [same](/how-we-work/constraints.md).",
      "![shot](brief.png)",
      "```",
      "[ignored](playbooks/no.md)",
      "```",
      "Not a link: [[constraints]]",
    ].join("\n");
    expect(extractOfficeMarkdownPaths(body)).toEqual([
      "how-we-work/constraints.md",
    ]);
  });
});

describe("knowledge link snapshot", () => {
  it("interns paths and inverts for backlinks", () => {
    let snap = emptyKnowledgeLinkSnapshot();
    snap = setKnowledgeLinkSource(snap, "for/example/this-file.md", [
      "how-we-work/constraints.md",
    ]);
    snap = setKnowledgeLinkSource(snap, "playbooks/weekly-update/SKILL.md", [
      "how-we-work/constraints.md",
      "for/example/this-file.md",
    ]);
    expect(knowledgeBacklinks(snap, "how-we-work/constraints.md")).toEqual([
      "for/example/this-file.md",
      "playbooks/weekly-update/SKILL.md",
    ]);
    expect(snap.paths.every((path) => !isKnowledgeLinksPath(path))).toBe(true);
    snap = dropKnowledgeLinkSource(snap, "for/example/this-file.md");
    expect(knowledgeBacklinks(snap, "how-we-work/constraints.md")).toEqual([
      "playbooks/weekly-update/SKILL.md",
    ]);
    snap = dropKnowledgeLinkPrefix(snap, "playbooks/weekly-update");
    expect(knowledgeBacklinks(snap, "how-we-work/constraints.md")).toEqual([]);
  });

  it("round-trips json", () => {
    const snap = setKnowledgeLinkSource(emptyKnowledgeLinkSnapshot(), "a.md", [
      "b.md",
    ]);
    const parsed = parseKnowledgeLinkSnapshot(JSON.stringify(snap));
    expect(parsed?.paths).toEqual(snap.paths);
    expect(parsed?.out).toEqual(snap.out);
  });
});

describe("KNOWLEDGE_MARKDOWN_LINK_HINT", () => {
  it("tells the agent how to link notes when writing a file", () => {
    expect(KNOWLEDGE_MARKDOWN_LINK_HINT).toMatch(
      /\[label\]\(path\/from\/office\/root\.md\)/,
    );
    expect(KNOWLEDGE_MARKDOWN_LINK_HINT).toMatch(/\[\[wikilinks\]\]/);
    expect(KNOWLEDGE_MARKDOWN_LINK_HINT).toMatch(/When you write a knowledge file/);
  });
});
