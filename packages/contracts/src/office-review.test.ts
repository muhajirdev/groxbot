import { describe, expect, it } from "vitest";
import {
  OFFICE_INTRO_SOURCE,
  OFFICE_REVIEW_SOURCE,
  isHiddenOfficeUserMessage,
  isOfficeIntroUserMessage,
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

  it("hides hire-intro the same way, without treating it as review", () => {
    const intro = {
      role: "user" as const,
      metadata: { custom: { source: OFFICE_INTRO_SOURCE } },
    };
    expect(isOfficeIntroUserMessage(intro)).toBe(true);
    expect(isHiddenOfficeUserMessage(intro)).toBe(true);
    expect(isOfficeReviewUserMessage(intro)).toBe(false);
    expect(
      isHiddenOfficeUserMessage({
        role: "user",
        metadata: { custom: { source: OFFICE_REVIEW_SOURCE } },
      }),
    ).toBe(true);
  });

  it("treats Skip as nothing to show", () => {
    expect(isOfficeReviewSkip("Skip")).toBe(true);
    expect(isOfficeReviewSkip(" skip ")).toBe(false);
  });
});
