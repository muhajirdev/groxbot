import { describe, expect, it } from "vitest";
import {
  clampPlanPeople,
  GROXBOT_PRO_MONTHLY_USD,
  labChargeLabel,
  labMonthlyUsd,
  peopleLabel,
  planListUsd,
  planPeriodLabel,
  stepPlanPeople,
} from "./plan-compare";

describe("labMonthlyUsd", () => {
  it("charges Claude / ChatGPT $20 per person", () => {
    expect(labMonthlyUsd(1)).toBe(20);
    expect(labChargeLabel(1)).toBe("$20 × 1");
    expect(labMonthlyUsd(10)).toBe(200);
    expect(labChargeLabel(10)).toBe("$20 × 10");
    expect(GROXBOT_PRO_MONTHLY_USD).toBe(29);
  });

  it("prices annual as 10 months", () => {
    expect(planListUsd("pro", "year")).toBe(290);
    expect(planListUsd("plus", "year")).toBe(490);
    expect(planListUsd("believers", "year")).toBe(990);
    expect(planPeriodLabel("year")).toBe("/yr");
  });

  it("steps people with + and −", () => {
    expect(stepPlanPeople(10, -1)).toBe(9);
    expect(stepPlanPeople(1, -1)).toBe(1);
    expect(stepPlanPeople(20, 1)).toBe(20);
    expect(clampPlanPeople(0)).toBe(1);
    expect(peopleLabel(1)).toBe("1 person");
    expect(peopleLabel(10)).toBe("10 people");
  });
});
