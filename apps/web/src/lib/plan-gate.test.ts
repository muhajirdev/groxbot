import { describe, expect, it } from "vitest";
import { onboardingNeedsPlan, planGateCopy } from "./plan-gate";

describe("planGateCopy", () => {
  it("asks for a trial before Polar has billed this workspace", () => {
    expect(planGateCopy(true)).toEqual({
      title: "Start free trial",
      body: "Three days of Pro. Card on file — cancel before it ends and you are not charged.",
      cta: "Start free trial",
    });
  });

  it("asks to subscribe after the trial is used up", () => {
    expect(planGateCopy(false).title).toBe("Your trial ended");
    expect(planGateCopy(false).cta).toBe("See plans");
  });
});

describe("onboardingNeedsPlan", () => {
  it("offers a trial before me is known", () => {
    expect(onboardingNeedsPlan(undefined, "ws-1")).toBe(true);
    expect(onboardingNeedsPlan(null, "ws-1")).toBe(true);
  });

  it("offers a trial when me is still the previous office", () => {
    expect(
      onboardingNeedsPlan(
        { workspaceId: "ws-old", needsHostedPlan: false },
        "ws-new",
      ),
    ).toBe(true);
  });

  it("skips the trial CTA after this office says it is free", () => {
    expect(
      onboardingNeedsPlan(
        { workspaceId: "ws-1", needsHostedPlan: false },
        "ws-1",
      ),
    ).toBe(false);
  });

  it("keeps the trial CTA when this office needs a plan", () => {
    expect(
      onboardingNeedsPlan(
        { workspaceId: "ws-1", needsHostedPlan: true },
        "ws-1",
      ),
    ).toBe(true);
  });
});
