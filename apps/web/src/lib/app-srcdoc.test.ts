import { describe, expect, it } from "vitest";
import { appSrcDoc } from "./app-srcdoc";

describe("app iframe document", () => {
  it("injects a parent bridge and blocks network", () => {
    const html = appSrcDoc("gadget.load()");
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("gadget.load");
    expect(html).toContain("gadget:call");
    expect(html).not.toContain("http://");
  });
});
