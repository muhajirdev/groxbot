import { describe, expect, it } from "vitest";
import { humanizeRunError, userFacingError } from "./errors";

describe("humanizeRunError", () => {
  it("rewrites Cloudflare error-code lines", () => {
    expect(humanizeRunError("error code: 1031")).toBe(
      "Could not reach this teammate. Try sending again.",
    );
  });

  it("rewrites a dead API fetch", () => {
    expect(humanizeRunError("Failed to fetch")).toBe(
      "Could not reach the office API.",
    );
  });
});

describe("userFacingError", () => {
  it("keeps a useful message and swaps generic HTTP names", () => {
    expect(userFacingError(new Error("Unauthorized"), "Sign in")).toBe(
      "Sign in",
    );
    expect(userFacingError(new Error("Paste a key"), "Sign in")).toBe(
      "Paste a key",
    );
  });
});
