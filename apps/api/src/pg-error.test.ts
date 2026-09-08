import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./pg-error";

describe("isUniqueViolation", () => {
  it("matches Postgres 23505", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("walks wrapped causes", () => {
    expect(
      isUniqueViolation({
        message: "insert failed",
        cause: { cause: { code: "23505" } },
      }),
    ).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isUniqueViolation(new Error("nope"))).toBe(false);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
  });
});
