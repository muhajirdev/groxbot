import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  renderShareMarkdown,
  resolveShareHref,
  sharePageHref,
} from "./share-markdown";

const ctx = {
  currentPath: "playbooks/weekly-update/SKILL.md",
  granted: "playbooks",
  kind: "folder" as const,
};

describe("escapeHtml", () => {
  it("escapes tags before markdown runs", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });
});

describe("resolveShareHref", () => {
  it("allows https and in-share office paths", () => {
    expect(resolveShareHref("https://example.com/a", ctx)).toEqual({
      href: "https://example.com/a",
    });
    expect(
      resolveShareHref("playbooks/weekly-update/notes.md", ctx),
    ).toEqual({
      href: "playbooks/weekly-update/notes.md",
      path: "playbooks/weekly-update/notes.md",
    });
  });

  it("rejects javascript, http, and paths outside the share", () => {
    expect(resolveShareHref("javascript:alert(1)", ctx)).toBeNull();
    expect(resolveShareHref("http://example.com", ctx)).toBeNull();
    expect(resolveShareHref("how-we-work/voice.md", ctx)).toBeNull();
    expect(resolveShareHref("_search/index.json", ctx)).toBeNull();
    expect(resolveShareHref("../../secret.md", ctx)).toBeNull();
  });

  it("resolves relative paths against the current file", () => {
    expect(resolveShareHref("./notes.md", ctx)).toEqual({
      href: "playbooks/weekly-update/notes.md",
      path: "playbooks/weekly-update/notes.md",
    });
  });
});

describe("renderShareMarkdown", () => {
  const render = (source: string) =>
    renderShareMarkdown(source, {
      shareId: "ks-1",
      ...ctx,
      rawUrl: (path) => `https://api.example/raw?path=${path}`,
    });

  it("escapes HTML and drops unsafe links", () => {
    const html = render(
      `<script>alert(1)</script>\n[safe](https://example.com)\n[bad](javascript:alert(1))\n[out](secrets.md)`,
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("bad");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain('href="secrets.md"');
  });

  it("turns in-share links into the public page", () => {
    const html = render("[notes](playbooks/weekly-update/notes.md)");
    expect(html).toContain(sharePageHref("ks-1", "playbooks/weekly-update/notes.md"));
  });
});
