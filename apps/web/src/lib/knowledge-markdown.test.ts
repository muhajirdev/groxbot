import { describe, expect, it } from "vitest";
import {
  knowledgeMarkdownHasHeading,
  splitKnowledgeMarkdown,
} from "./knowledge-markdown";

describe("splitKnowledgeMarkdown", () => {
  it("strips fenced YAML and reads title, updated, source", () => {
    const { meta, body } = splitKnowledgeMarkdown(
      "---\ntitle: Resources for agents\nupdated: 2026-09-02\nsource: https://expandra.ai/developers\n---\n# Resources for agents\n\n- one\n",
    );
    expect(meta).toEqual({
      title: "Resources for agents",
      description: "",
      updated: "2026-09-02",
      source: "https://expandra.ai/developers",
    });
    expect(body).toBe("# Resources for agents\n\n- one\n");
  });

  it("uses skill name when title is absent", () => {
    const { meta, body } = splitKnowledgeMarkdown(
      "---\nname: weekly-update\ndescription: Five-bullet Monday.\n---\nWrite five bullets.\n",
    );
    expect(meta.title).toBe("weekly-update");
    expect(meta.description).toBe("Five-bullet Monday.");
    expect(body).toBe("Write five bullets.\n");
  });

  it("leaves notes without a fence unchanged", () => {
    const raw = "# How we work\n\nTalk first.\n";
    expect(splitKnowledgeMarkdown(raw)).toEqual({
      meta: { title: "", description: "", updated: "", source: "" },
      body: raw,
    });
  });

  it("unquotes YAML scalars", () => {
    const { meta } = splitKnowledgeMarkdown(
      "---\ntitle: \"Halo Minikube\"\ndescription: 'Tutorial minikube.'\n---\nDeploy.\n",
    );
    expect(meta.title).toBe("Halo Minikube");
    expect(meta.description).toBe("Tutorial minikube.");
  });

  it("treats an unclosed fence as body", () => {
    const raw = "---\ntitle: Broken\n# Still a heading\n";
    expect(splitKnowledgeMarkdown(raw).body).toBe(raw);
  });
});

describe("knowledgeMarkdownHasHeading", () => {
  it("detects a leading ATX heading", () => {
    expect(knowledgeMarkdownHasHeading("# Resources for agents\n\nHi")).toBe(
      true,
    );
    expect(knowledgeMarkdownHasHeading("  ## Nested\n")).toBe(true);
    expect(knowledgeMarkdownHasHeading("Resources for agents\n")).toBe(false);
    expect(knowledgeMarkdownHasHeading("# ")).toBe(false);
  });
});
