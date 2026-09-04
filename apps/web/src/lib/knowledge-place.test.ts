import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/KnowledgePlace.tsx"),
  "utf8",
);

describe("knowledge library search", () => {
  it("calls the office BM25 index, not only the tree filter", () => {
    expect(src).toMatch(/orpc\.knowledge\.search/);
    expect(src).toMatch(/searchHits/);
    expect(src).toMatch(/knowledge-search-status/);
    expect(src).toMatch(/Searching notes/);
  });
});
