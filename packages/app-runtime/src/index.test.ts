import { describe, expect, it } from "vitest";
import { filesForTemplate, MemoryAppStore } from "./index.js";
import { evalSheet } from "./sheets-engine.js";

describe("app templates", () => {
  it("stamps Cloudflare OS client and Gadget server per template", () => {
    for (const id of ["docs", "slides", "sheets"] as const) {
      const files = filesForTemplate(id);
      expect(files["client.js"]).toContain("gadget.subscribe");
      expect(files["server.js"]).toContain("export class Gadget");
      expect(files["client.js"]).not.toContain("gadget.load");
    }
    expect(filesForTemplate("docs")["client.js"]).toContain("contenteditable");
    expect(filesForTemplate("docs")["client.js"]).toContain("applyOperation");
    expect(filesForTemplate("slides")["client.js"]).toContain("getDeck");
    expect(filesForTemplate("sheets")["client.js"]).toContain("applyOperation");
  });

  it("inits an in-memory app id for tests", async () => {
    const store = new MemoryAppStore();
    await store.init("app_1", "docs", { workspaceId: "ws_1", title: "Q3" });
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
