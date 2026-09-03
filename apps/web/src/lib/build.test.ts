import { describe, expect, it } from "vitest";
import { shortRevision } from "./build";

describe("shortRevision", () => {
  it("keeps a seven-character SHA", () => {
    expect(shortRevision("d4b3ea8")).toBe("d4b3ea8");
  });

  it("clips a full SHA", () => {
    expect(shortRevision("d4b3ea85c509a1448efe99e7080568553036b318")).toBe(
      "d4b3ea8",
    );
  });

  it("falls back to dev", () => {
    expect(shortRevision("")).toBe("dev");
    expect(shortRevision("   ")).toBe("dev");
    expect(shortRevision("dev")).toBe("dev");
  });
});
