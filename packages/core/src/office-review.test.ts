import { describe, expect, it } from "vitest";
import {
  applyOfficeReviewTurn,
  assistantTurnSettled,
  countUiToolParts,
  emptyOfficeReviewCounters,
  isOfficeReviewSkip,
  isOfficeReviewUserMessage,
  officeReviewDue,
  officeReviewUserMessage,
  officeReviewUserText,
  parseOfficeReviewCounters,
  shouldEnqueueOfficeReview,
} from "./office-review.js";

describe("office review cadence", () => {
  it("counts tool parts and comes due at 15", () => {
    let counters = emptyOfficeReviewCounters();
    counters = applyOfficeReviewTurn(
      counters,
      countUiToolParts([]),
      false,
    );
    expect(officeReviewDue(counters)).toBe(false);
    counters = applyOfficeReviewTurn(
      counters,
      countUiToolParts([
        { type: "step-start" },
        { type: "tool-execute" },
        { type: "text", text: "hi" },
      ]),
      false,
    );
    expect(counters.toolIters).toBe(1);
    expect(officeReviewDue({ toolIters: 14, lastMessageTools: 0 })).toBe(false);
    expect(officeReviewDue({ toolIters: 15, lastMessageTools: 0 })).toBe(true);
  });

  it("does not double-count tools on a continuation of the same message", () => {
    let counters = applyOfficeReviewTurn(emptyOfficeReviewCounters(), 3, false);
    counters = applyOfficeReviewTurn(counters, 8, true);
    expect(counters.toolIters).toBe(8);
    counters = applyOfficeReviewTurn(counters, 8, true);
    expect(counters.toolIters).toBe(8);
  });

  it("waits for tool parts to settle", () => {
    expect(
      assistantTurnSettled([{ type: "tool-execute", state: "input-available" }]),
    ).toBe(false);
    expect(
      assistantTurnSettled([
        { type: "tool-execute", state: "output-available" },
      ]),
    ).toBe(true);
  });

  it("enqueues only a settled, due turn with office knowledge", () => {
    const due = { toolIters: 15, lastMessageTools: 4 };
    expect(
      shouldEnqueueOfficeReview({
        status: "completed",
        reviewBusy: false,
        hasOfficeKnowledge: true,
        settled: true,
        counters: due,
      }),
    ).toBe(true);
    expect(
      shouldEnqueueOfficeReview({
        status: "completed",
        reviewBusy: true,
        hasOfficeKnowledge: true,
        settled: true,
        counters: due,
      }),
    ).toBe(false);
    expect(
      shouldEnqueueOfficeReview({
        status: "completed",
        reviewBusy: false,
        hasOfficeKnowledge: true,
        settled: false,
        counters: due,
      }),
    ).toBe(false);
  });

  it("ignores junk storage", () => {
    expect(parseOfficeReviewCounters(null)).toEqual({
      toolIters: 0,
      lastMessageTools: 0,
    });
    expect(parseOfficeReviewCounters({ toolIters: 3.9 }).toolIters).toBe(3);
  });
});

describe("office review messages", () => {
  it("tags the nudge so the thread can hide it", () => {
    const msg = officeReviewUserMessage();
    expect(isOfficeReviewUserMessage(msg)).toBe(true);
    expect(isOfficeReviewUserMessage({ role: "user", metadata: {} })).toBe(
      false,
    );
    expect(officeReviewUserText()).toMatch(/When you write a knowledge file/);
    expect(officeReviewUserText()).toMatch(/\[label\]\(path\/from\/office\/root\.md\)/);
    expect(officeReviewUserText()).toMatch(/skill_manage patch/);
    expect(officeReviewUserText()).toMatch(/Skip/);
  });

  it("treats Skip as nothing to announce", () => {
    expect(isOfficeReviewSkip("Skip")).toBe(true);
    expect(isOfficeReviewSkip("skip")).toBe(false);
    expect(isOfficeReviewSkip("Saved skills/weekly-update/SKILL.md")).toBe(
      false,
    );
  });
});
