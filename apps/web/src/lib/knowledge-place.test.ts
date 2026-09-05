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

describe("knowledge share toasts", () => {
  it("toasts that the public link was copied after share or copy", () => {
    expect(src).toContain("TOAST_SHARED_LINK_COPIED");
    expect(src).toContain("TOAST_LINK_COPIED");
    expect(src).toContain("copyAndToast");
    expect(src).toContain("officeHref");
  });
});
