import { describe, expect, it } from "vitest";
import { connectorRecord, connectorString } from "./connector-args.js";

describe("connectorRecord", () => {
  it("maps a lone string onto the positional key", () => {
    expect(connectorRecord("skills/web-research/SKILL.md", "path")).toEqual({
      path: "skills/web-research/SKILL.md",
    });
  });

  it("passes objects through", () => {
    expect(connectorRecord({ path: "notes.md", extra: 1 }, "path")).toEqual({
      path: "notes.md",
      extra: 1,
    });
  });

  it("does not treat a string as an object when there is no positional key", () => {
    expect(connectorRecord("notes.md")).toBeUndefined();
  });
});

describe("connectorString", () => {
  it("reads path from { path } or a lone string", () => {
    expect(connectorString({ path: "a.md" }, "path", true)).toBe("a.md");
    expect(connectorString("a.md", "path", true)).toBe("a.md");
  });

  it("does not fill path from a lone string unless positional", () => {
    expect(connectorString("a.md", "path")).toBeUndefined();
    expect(connectorString({ path: "a.md" }, "path")).toBe("a.md");
  });
});
