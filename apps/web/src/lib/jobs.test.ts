import { BOT_MARKETPLACE_STARTER_JOBS } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { FIRST_HIRE, SUGGESTED_JOBS } from "./jobs";

describe("SUGGESTED_JOBS", () => {
  it("matches the shared marketplace starter list", () => {
    expect([...SUGGESTED_JOBS]).toEqual([...BOT_MARKETPLACE_STARTER_JOBS]);
    expect(SUGGESTED_JOBS).toContain("Chief of Staff");
    expect(FIRST_HIRE).toBe(SUGGESTED_JOBS[0]);
  });
});
