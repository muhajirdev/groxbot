import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComputerTextPreview } from "./ComputerFilePreview";

describe("ComputerTextPreview", () => {
  it("renders markdown instead of a pre block", () => {
    const html = renderToStaticMarkup(
      createElement(ComputerTextPreview, {
        path: "notes/q3.md",
        content: "# Q3\n\n- ship the chip",
        truncated: false,
      }),
    );
    expect(html).toContain("knowledge-preview-md");
    expect(html).toContain("knowledge-md");
    expect(html).toContain("<h1>Q3</h1>");
    expect(html).toContain("<ul");
    expect(html).not.toContain("<pre>");
  });

  it("keeps plain text in a pre", () => {
    const html = renderToStaticMarkup(
      createElement(ComputerTextPreview, {
        path: "notes.txt",
        content: "plain notes",
        truncated: false,
      }),
    );
    expect(html).toContain("computer-preview-text");
    expect(html).toContain("<pre>plain notes</pre>");
    expect(html).not.toContain("knowledge-preview-md");
  });
});
