import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ChatMarkdown } from "../components/ChatMarkdown";
import { safeMarkdownUrl } from "./chat-markdown";

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
});
