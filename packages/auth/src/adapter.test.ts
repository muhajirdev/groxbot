import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("createAuth", () => {
  it("uses the sqlite drizzle adapter", () => {
    const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(src).toMatch(/provider: "sqlite"/);
    expect(src).not.toMatch(/provider: "pg"/);
  });
});
