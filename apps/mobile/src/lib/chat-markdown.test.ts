import { describe, expect, it } from "vitest";
import {
  parseChatMarkdown,
  parseInline,
  safeMarkdownUrl,
} from "./chat-markdown";

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

describe("parseChatMarkdown", () => {
  it("parses emphasis, lists, and fenced code", () => {
    const blocks = parseChatMarkdown(
      "Hi **Reja**\n\n1. one\n2. two\n\n```\ncode\n```",
    );
    expect(blocks[0]).toMatchObject({ kind: "p" });
    expect(parseInline("Hi **Reja**")).toEqual([
      { kind: "text", text: "Hi " },
      { kind: "strong", text: "Reja" },
    ]);
    expect(blocks.some((block) => block.kind === "ol")).toBe(true);
    expect(blocks.some((block) => block.kind === "code")).toBe(true);
  });

  it("keeps link hrefs for the renderer to sanitize", () => {
    const [block] = parseChatMarkdown(
      "[docs](https://example.com) [bad](javascript:alert)",
    );
    expect(block?.kind).toBe("p");
    if (block?.kind !== "p") return;
    expect(block.inlines).toEqual(
      expect.arrayContaining([
        { kind: "link", text: "docs", href: "https://example.com" },
        { kind: "link", text: "bad", href: "javascript:alert" },
      ]),
    );
    expect(safeMarkdownUrl("javascript:alert")).toBeNull();
  });
});
