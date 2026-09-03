import { describe, expect, it } from "vitest";
import {
  OFFICE_REVIEW_SOURCE,
  isOfficeReviewSkip,
  isOfficeReviewUserMessage,
} from "./office-review.js";

describe("office review identity", () => {
  it("reads source from metadata.custom (assistant-ui keeps that)", () => {
    expect(
      isOfficeReviewUserMessage({
        role: "user",
        metadata: { custom: { source: OFFICE_REVIEW_SOURCE } },
      }),
    ).toBe(true);
    expect(
      isOfficeReviewUserMessage({
        role: "user",
        metadata: { source: OFFICE_REVIEW_SOURCE },
      }),
    ).toBe(true);
    expect(
      isOfficeReviewUserMessage({ role: "user", metadata: {} }),
    ).toBe(false);
    expect(
      isOfficeReviewUserMessage({
        role: "assistant",
        metadata: { source: OFFICE_REVIEW_SOURCE },
      }),
    ).toBe(false);
  });

  it("treats Skip as nothing to show", () => {
    expect(isOfficeReviewSkip("Skip")).toBe(true);
    expect(isOfficeReviewSkip(" skip ")).toBe(false);
  });
});
