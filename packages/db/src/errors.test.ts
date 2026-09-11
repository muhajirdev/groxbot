import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./errors.js";

describe("isUniqueViolation", () => {
  it("matches Postgres 23505 leftover dumps", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("matches SQLite unique failures", () => {
    expect(isUniqueViolation({ code: "SQLITE_CONSTRAINT_UNIQUE" })).toBe(true);
    expect(
      isUniqueViolation({ message: "UNIQUE constraint failed: messages.thread_id" }),
    ).toBe(true);
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
