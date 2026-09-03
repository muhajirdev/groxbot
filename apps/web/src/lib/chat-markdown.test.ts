import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatMarkdown } from "../components/ChatMarkdown";
import { KnowledgeMarkdown } from "../components/KnowledgeFilePreview";
import { safeMarkdownUrl } from "./chat-markdown";
import { knowledgeMarkdownUrl } from "./knowledge-link";

describe("safeMarkdownUrl", () => {
  it("keeps http, https, and mailto", () => {
    expect(safeMarkdownUrl("https://example.com/a")).toBe(
      "https://example.com/a",
    );
    expect(safeMarkdownUrl("http://127.0.0.1/x")).toBe("http://127.0.0.1/x");
    expect(safeMarkdownUrl("mailto:a@b.co")).toBe("mailto:a@b.co");
  });

  it("drops javascript, relative, and other schemes", () => {
    expect(safeMarkdownUrl("javascript:alert(1)")).toBeNull();
    expect(safeMarkdownUrl("/onboarding")).toBeNull();
    expect(safeMarkdownUrl("data:text/html,hi")).toBeNull();
  });
});

describe("ChatMarkdown", () => {
  it("renders emphasis, lists, and safe links", () => {
    const html = renderToStaticMarkup(
      createElement(ChatMarkdown, {
        text: "Hi **Reja**\n\n1. one\n2. two\n\n[docs](https://example.com) [bad](javascript:alert(1))",
      }),
    );
    expect(html).toContain("<strong>Reja</strong>");
    expect(html).toContain("<ol");
    expect(html).toContain('href="https://example.com');
    expect(html).not.toContain("javascript:");
  });

  it("drops office paths in chat", () => {
    const html = renderToStaticMarkup(
      createElement(ChatMarkdown, {
        text: "See [voice](how-we-work/voice.md) and [[voice]]",
      }),
    );
    expect(html).not.toContain('href="how-we-work/voice.md"');
    expect(html).toContain("[[voice]]");
  });

  it("keeps office paths when the knowledge transform is on", () => {
    const html = renderToStaticMarkup(
      createElement(ChatMarkdown, {
        text: "See [voice](how-we-work/voice.md)",
        officePaths: true,
        urlTransform: knowledgeMarkdownUrl,
      }),
    );
    expect(html).toContain("/how-we-work/voice.md");
  });

  it("marks document markdown for the knowledge reader", () => {
    const html = renderToStaticMarkup(
      createElement(ChatMarkdown, {
        text: "# Resources\n\n- one",
        variant: "document",
      }),
    );
    expect(html).toContain("knowledge-md");
    expect(html).not.toContain("chat-md");
    expect(html).toContain("<h1>Resources</h1>");
    expect(html).toContain("<ul");
  });
});

describe("KnowledgeMarkdown", () => {
  it("hides fenced YAML and keeps the document heading", () => {
    const html = renderToStaticMarkup(
      createElement(KnowledgeMarkdown, {
        text: "---\ntitle: Resources for agents\nupdated: 2026-09-02\n---\n# Resources for agents\n\n- handbook\n",
      }),
    );
    expect(html).toContain("knowledge-md");
    expect(html).toContain("<h1>Resources for agents</h1>");
    expect(html).toContain("<ul");
    expect(html).not.toContain("title:");
    expect(html).toContain("Updated 2026-09-02");
  });
});
