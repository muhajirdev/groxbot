import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Worker barrel", () => {
  it("re-exports openObjectParameters from @groxbot/adapters/edge", () => {
    const edge = readFileSync(
      fileURLToPath(new URL("./edge.ts", import.meta.url)),
      "utf8",
    );
    expect(edge).toMatch(/openObjectParameters/);
  });
});
