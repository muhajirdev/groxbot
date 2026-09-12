import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HERO_COMPARE_NAMES, HERO_LEDE } from "../lib/copy";
import { HeroCompare, measureActiveWidth } from "./HeroCompare";

describe("HeroCompare", () => {
  it("names Hermes Agent, OpenClaw, and Grok Bot as the solo tools", () => {
    const html = renderToStaticMarkup(createElement(HeroCompare));

    for (const name of HERO_COMPARE_NAMES) {
      expect(html).toContain(name);
    }
    expect(html).toContain("hero-swap-sizer");
    expect(html).toContain("but for teams.");
    expect(html).toContain(HERO_LEDE);
  });

  it("sizes the swap slot to the active name, not the longest", () => {
    const track = {
      children: HERO_COMPARE_NAMES.map((name) => ({
        scrollWidth: name.length * 10,
      })),
    };

    expect(measureActiveWidth(track, 0)).toBe("Hermes Agent".length * 10);
    expect(measureActiveWidth(track, 1)).toBe("OpenClaw".length * 10);
    expect(measureActiveWidth(track, 2)).toBe("Grok Bot".length * 10);
    expect(measureActiveWidth(track, 0)).not.toBe(measureActiveWidth(track, 1));
  });
});
