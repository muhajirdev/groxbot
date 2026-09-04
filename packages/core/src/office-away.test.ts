import { OFFICE_INTRO_SOURCE, OFFICE_REVIEW_SOURCE } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  OFFICE_AWAY_TURN_MS,
  awayOfficeExcerpt,
  lastOfficeHumanUserId,
  parseOfficeAwayPayload,
  parseOfficeAwayStored,
  shouldArmAwayOfficePing,
  shouldSendAwayOfficePing,
} from "./office-away.js";

const baseArm = {
  visible: true,
  startedAt: 1_000,
  now: 1_000 + OFFICE_AWAY_TURN_MS,
  subscriberCount: 0,
  touched: false,
  seq: 4,
};

describe("shouldArmAwayOfficePing", () => {
  it("arms after the testing threshold when the office is empty", () => {
    expect(shouldArmAwayOfficePing(baseArm)).toBe(true);
  });

  it("does not arm a 29s turn", () => {
    expect(
      shouldArmAwayOfficePing({
        ...baseArm,
        now: 1_000 + OFFICE_AWAY_TURN_MS - 1,
      }),
    ).toBe(false);
  });

  it("does not arm while someone is on the office socket", () => {
    expect(
      shouldArmAwayOfficePing({ ...baseArm, subscriberCount: 1 }),
    ).toBe(false);
  });

  it("skips intro/review, steered turns, and a seq already pinged", () => {
    expect(shouldArmAwayOfficePing({ ...baseArm, visible: false })).toBe(false);
    expect(shouldArmAwayOfficePing({ ...baseArm, touched: true })).toBe(false);
    expect(shouldArmAwayOfficePing({ ...baseArm, pingedSeq: 4 })).toBe(false);
    expect(shouldArmAwayOfficePing({ ...baseArm, seq: 0 })).toBe(false);
  });
});

describe("shouldSendAwayOfficePing", () => {
  it("sends when the office is still empty for that seq", () => {
    expect(
      shouldSendAwayOfficePing({
        subscriberCount: 0,
        seq: 4,
        stored: { seq: 4, scheduleId: "sch_1" },
      }),
    ).toBe(true);
  });

  it("does not send after they reopen or after a send", () => {
    expect(
      shouldSendAwayOfficePing({
        subscriberCount: 1,
        seq: 4,
        stored: { seq: 4 },
      }),
    ).toBe(false);
    expect(
      shouldSendAwayOfficePing({
        subscriberCount: 0,
        seq: 4,
        stored: { seq: 4, pingedSeq: 4 },
      }),
    ).toBe(false);
    expect(
      shouldSendAwayOfficePing({
        subscriberCount: 0,
        seq: 4,
        stored: { seq: 9 },
      }),
    ).toBe(false);
  });
});

describe("away office parse", () => {
  it("reads a payload and stored row", () => {
    expect(parseOfficeAwayPayload({ seq: 3, excerpt: "Done." })).toBeNull();
    expect(
      parseOfficeAwayPayload({
        seq: 3,
        excerpt: "Done.",
        toUserId: "user_sam",
      }),
    ).toEqual({
      seq: 3,
      excerpt: "Done.",
      toUserId: "user_sam",
    });
    expect(parseOfficeAwayPayload({ seq: 0 })).toBeNull();
    expect(
      parseOfficeAwayStored({ seq: 3, scheduleId: "sch_1", pingedSeq: 2 }),
    ).toEqual({ seq: 3, scheduleId: "sch_1", pingedSeq: 2 });
  });

  it("trims excerpts", () => {
    expect(awayOfficeExcerpt("  hello\nthere  ")).toBe("hello there");
    expect(awayOfficeExcerpt("x".repeat(200)).endsWith("…")).toBe(true);
  });
});

describe("lastOfficeHumanUserId", () => {
  it("takes the last stamped human, not the owner", () => {
    expect(
      lastOfficeHumanUserId([
        {
          metadata: { user: { userId: "user_alex", name: "Alex" } },
          message: { role: "user" },
        },
        {
          metadata: { user: { userId: "user_sam", name: "Sam" } },
          message: { role: "user" },
        },
        { message: { role: "assistant" } },
      ]),
    ).toBe("user_sam");
  });

  it("does not use intro, review, or a routine kick", () => {
    expect(
      lastOfficeHumanUserId([
        {
          metadata: { user: { userId: "user_sam", name: "Sam" } },
          message: { role: "user" },
        },
        {
          metadata: { source: OFFICE_REVIEW_SOURCE },
          message: { role: "user" },
        },
      ]),
    ).toBeNull();
    expect(
      lastOfficeHumanUserId([
        {
          metadata: { source: OFFICE_INTRO_SOURCE },
          message: { role: "user" },
        },
      ]),
    ).toBeNull();
    expect(
      lastOfficeHumanUserId([
        {
          metadata: { source: "routine", custom: { source: "routine" } },
          message: { role: "user" },
        },
      ]),
    ).toBeNull();
  });
});
