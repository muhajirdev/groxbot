import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BOOT_TEAM, BootSplash } from "./BootSplash";

describe("BootSplash", () => {
  it("paints a team cluster and the Groxbot word", () => {
    const html = renderToStaticMarkup(createElement(BootSplash));
    expect(html).toContain('data-boot-splash="true"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Opening Groxbot");
    expect(html).toContain("boot-enter");
    expect(html).toContain("Groxbot");
    expect(html).toContain("boot-faces");
    for (const face of BOOT_TEAM) {
      expect(html).toContain(face.color);
      expect(html).toContain(`<title>${face.name}</title>`);
    }
  });

  it("embeds without the full-screen gate chrome", () => {
    const html = renderToStaticMarkup(
      createElement(BootSplash, { embed: true }),
    );
    expect(html).toContain("boot-splash-embed");
    expect(html).not.toContain("screen boot-splash");
  });
});
