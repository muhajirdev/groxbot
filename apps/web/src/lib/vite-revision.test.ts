import { describe, expect, it } from "vitest";
import { gitRevision } from "../../vite-revision";

describe("gitRevision", () => {
  it("returns a SHA when git is available", () => {
    const sha = gitRevision();
    expect(sha).toMatch(/^[0-9a-f]{7,40}$|^dev$/);
  });
});
