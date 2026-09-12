import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HERO_DEMO, TALK_DEMO, heroDemoSrc } from "../lib/copy";
import { HeroDemo } from "./HeroDemo";

describe("HeroDemo", () => {
  it("autoplays the muted YouTube banner for the given demo", () => {
    const html = renderToStaticMarkup(
      createElement(HeroDemo, { demo: HERO_DEMO, id: "demo" }),
    );

    expect(html).toContain(`id="demo"`);
    expect(html).toContain("<iframe");
    expect(html).toContain(HERO_DEMO.youtubeId);
    expect(html).toContain("autoplay=1");
    expect(html).toContain(HERO_DEMO.title);
    expect(html).not.toContain(TALK_DEMO.youtubeId);
    expect(html).not.toContain("<video");
  });

  it("can embed a different talk-section video", () => {
    const html = renderToStaticMarkup(
      createElement(HeroDemo, { demo: TALK_DEMO, id: "talk-demo" }),
    );
    const src = heroDemoSrc(TALK_DEMO.youtubeId, {
      autoplay: true,
      mute: true,
      loop: true,
    });

    expect(html).toContain(`id="talk-demo"`);
    expect(html).toContain(TALK_DEMO.youtubeId);
    expect(html).not.toContain(HERO_DEMO.youtubeId);
    expect(src).toContain("autoplay=1");
    expect(src).toContain("mute=1");
    expect(src).toContain("loop=1");
    expect(TALK_DEMO.youtubeId).not.toBe(HERO_DEMO.youtubeId);
  });
});
