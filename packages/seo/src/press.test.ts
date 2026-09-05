import { describe, expect, it } from "vitest";
import { cloudOrigins } from "./identity.js";
import {
  PRESS_ASSETS,
  PRESS_SHORT,
  pressFacts,
  pressMarkdown,
} from "./press.js";
import { lookupDiscovery } from "./routes.js";

const origins = cloudOrigins();

describe("press kit", () => {
  it("publishes markdown with boilerplate, names, and SVG links", () => {
    const md = pressMarkdown(origins);
    expect(md).toContain("# Groxbot press kit");
    expect(md).toContain(PRESS_SHORT);
    expect(md).toContain("Do not use");
    expect(md).toContain("Grokbot");
    for (const asset of PRESS_ASSETS) {
      expect(md).toContain(`/press/${asset.file}`);
    }
    expect(md).toContain("/og.png");
    expect(md).toContain("/og.svg");
    expect(pressFacts(origins).some((fact) => fact.label === "License")).toBe(
      true,
    );
    expect(pressFacts(origins).some((fact) => fact.label === "Tagline")).toBe(
      true,
    );
  });

  it("is a discovery document", () => {
    const doc = lookupDiscovery("/press.md", origins);
    expect(doc?.contentType).toContain("text/markdown");
    expect(doc?.body).toContain("Groxbot press kit");
  });
});
