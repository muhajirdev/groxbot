import { describe, expect, it } from "vitest";
import { skillImportSummary } from "./knowledge-import";

describe("skillImportSummary", () => {
  it("names a single import", () => {
    expect(
      skillImportSummary({
        imported: [{ name: "weekly-update" }],
        skipped: [],
      }),
    ).toBe("Imported /weekly-update into skills/.");
  });

  it("uses the skip reason when nothing landed", () => {
    expect(
      skillImportSummary({
        imported: [],
        skipped: [{ name: "weekly-update", reason: "Already in the office." }],
      }),
    ).toBe("Already in the office.");
  });
});
