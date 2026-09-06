import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OfficePreview } from "./OfficePreview";

describe("OfficePreview", () => {
  it("renders the current office chrome, not the old mac window", () => {
    const html = renderToStaticMarkup(createElement(OfficePreview));

    expect(html).toContain("Acme");
    expect(html).toContain("Chief of Staff");
    expect(html).toContain("Knowledge");
    expect(html).toContain("Skills");
    expect(html).toContain("Live apps");
    expect(html).toContain("Plugins");
    expect(html).toContain("computer");
    expect(html).toContain("Morning digest");
    expect(html).toContain("Create routine");
    expect(html).toContain("Message Chief of Staff");
    expect(html).not.toContain("window-bar");
    expect(html).not.toContain("Message Ops");
    expect(html).not.toContain("Lid closed");
  });
});
