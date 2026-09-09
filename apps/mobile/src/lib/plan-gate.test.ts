import { describe, expect, it } from "vitest";
import {
  onboardingNeedsPlan,
  onboardingPlanReady,
  planGateCopy,
} from "./plan-gate";

describe("planGateCopy", () => {
  it("offers a trial when Polar still has one", () => {
    expect(planGateCopy(true).cta).toBe("Start free trial");
  });

  it("asks to subscribe after the trial", () => {
    expect(planGateCopy(false).title).toBe("Your trial ended");
  });
});

describe("onboardingNeedsPlan", () => {
  it("stays gated until me matches this workspace", () => {
    expect(onboardingNeedsPlan({ workspaceId: "other" }, "ws")).toBe(true);
    expect(
      onboardingNeedsPlan(
        { workspaceId: "ws", needsHostedPlan: false },
        "ws",
      ),
    ).toBe(false);
  });
});

describe("onboardingPlanReady", () => {
  it("waits for this workspace’s me row", () => {
    expect(onboardingPlanReady({ workspaceId: "ws" }, "ws")).toBe(true);
    expect(onboardingPlanReady(null, "ws")).toBe(false);
  });
});
