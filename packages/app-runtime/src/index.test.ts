import { describe, expect, it } from "vitest";
import { filesForTemplate, MemoryAppStore } from "./index.js";
import { evalSheet } from "./sheets-engine.js";

describe("app templates", () => {
  it("stamps client and server files per template", () => {
    for (const id of ["docs", "slides", "sheets"] as const) {
      const files = filesForTemplate(id);
      expect(files["client.js"]).toContain("gadget.load");
      expect(files["server.js"]).toContain("export class App");
    }
  });

  it("loads and saves state in memory", async () => {
    const store = new MemoryAppStore();
    await store.init("app_1", "docs");
    const loaded = (await store.call("app_1", "load", [])) as {
      title: string;
    };
    expect(loaded.title).toBe("Untitled");
    await store.call("app_1", "save", [{ title: "Q3", html: "<p>hi</p>" }]);
    const next = (await store.call("app_1", "load", [])) as {
      title: string;
      html: string;
    };
    expect(next.title).toBe("Q3");
    expect(next.html).toContain("hi");
    const bundle = await store.uiBundle("app_1");
    expect(bundle?.jsCode).toContain("contentEditable");
  });
});

describe("sheets engine", () => {
  it("sums a range and adds refs", () => {
    const cells = {
      A1: "2",
      A2: "3",
      A3: "5",
      B1: "=SUM(A1:A3)",
      C1: "=A1+B1",
    };
    expect(evalSheet(cells, "B1")).toBe(10);
    expect(evalSheet(cells, "C1")).toBe(12);
  });

  it("flags cycles", () => {
    expect(evalSheet({ A1: "=B1", B1: "=A1" }, "A1")).toBe("#CYCLE!");
  });
});
