import { describe, expect, it } from "vitest";
import {
  billingLimitsEnabled,
  hostedSubscriptionAllowsUsage,
  hostedUsageDecision,
  includedUsagePercent,
  onDemandUsageActive,
  UsageLimitExceededError,
  utcMonthStart,
  utcMonthStartIso,
} from "./billing.js";

describe("billing limits", () => {
  const baseBilling = {
    plan: "pro",
    status: "active",
    monthlyIncludedSpendCents: null,
    monthlyTokenLimit: 1_000_000,
    onDemandEnabled: false,
    onDemandSpendCapCents: null,
  };

  it("is off until Polar is configured", () => {
    expect(billingLimitsEnabled({})).toBe(false);
    expect(billingLimitsEnabled({ GROXBOT_HOSTED_AI: "1" })).toBe(false);
    expect(billingLimitsEnabled({ POLAR_ACCESS_TOKEN: "pat_test" })).toBe(
      true,
    );
  });

  it("uses UTC month boundaries", () => {
    const start = utcMonthStart(new Date("2026-09-15T12:34:56.789Z"));
    expect(start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(utcMonthStartIso(new Date("2026-09-15T12:34:56.789Z"))).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });

  it("names the usage limit error", () => {
    expect(new UsageLimitExceededError().name).toBe("UsageLimitExceededError");
  });

  it("routes exhausted included pools to on-demand when enabled", () => {
    expect(
      hostedUsageDecision(
        { ...baseBilling, onDemandEnabled: true },
        { includedSpendCents: 0, onDemandSpendCents: 0, includedTokens: 1_000_000 },
      ),
    ).toBe("on_demand");
  });

  it("blocks when included is exhausted and on-demand is off", () => {
    expect(
      hostedUsageDecision(baseBilling, {
        includedSpendCents: 0,
        onDemandSpendCents: 0,
        includedTokens: 1_000_000,
      }),
    ).toBe("blocked");
  });

  it("respects on-demand spend caps", () => {
    expect(
      hostedUsageDecision(
        {
          ...baseBilling,
          onDemandEnabled: true,
          onDemandSpendCapCents: 500,
        },
        {
          includedSpendCents: 0,
          onDemandSpendCents: 500,
          includedTokens: 1_000_000,
        },
      ),
    ).toBe("blocked");
  });

  it("prefers spend limits over token limits when both are set", () => {
    expect(
      hostedUsageDecision(
        {
          ...baseBilling,
          monthlyIncludedSpendCents: 2_000,
          monthlyTokenLimit: 1_000_000,
        },
        { includedSpendCents: 2_000, onDemandSpendCents: 0, includedTokens: 0 },
      ),
    ).toBe("blocked");
  });

  it("computes included usage percent from spend when configured", () => {
    expect(
      includedUsagePercent(
        { monthlyIncludedSpendCents: 2_000, monthlyTokenLimit: null },
        { includedSpendCents: 500, includedTokens: 0 },
      ),
    ).toBe(25);
  });

  it("caps included usage percent at 100", () => {
    expect(
      includedUsagePercent(
        { monthlyIncludedSpendCents: 1_000, monthlyTokenLimit: null },
        { includedSpendCents: 1_500, includedTokens: 0 },
      ),
    ).toBe(100);
  });

  it("returns null when there is no monthly cap", () => {
    expect(
      includedUsagePercent(
        { monthlyIncludedSpendCents: null, monthlyTokenLimit: null },
        { includedSpendCents: 500, includedTokens: 50_000 },
      ),
    ).toBeNull();
  });

  it("flags on-demand when included usage is exhausted", () => {
    expect(
      onDemandUsageActive(
        {
          ...baseBilling,
          monthlyIncludedSpendCents: 1_000,
          onDemandEnabled: true,
        },
        { includedSpendCents: 1_000, onDemandSpendCents: 0, includedTokens: 0 },
      ),
    ).toBe(true);
  });

  it("blocks free workspaces when limits are enforced", () => {
    expect(
      hostedUsageDecision(
        {
          plan: "none",
          status: "none",
          monthlyIncludedSpendCents: null,
          monthlyTokenLimit: null,
          onDemandEnabled: false,
          onDemandSpendCapCents: null,
        },
        { includedSpendCents: 0, onDemandSpendCents: 0, includedTokens: 0 },
        { limitsEnforced: true },
      ),
    ).toBe("blocked");
  });

  it("allows past_due subscriptions with configured limits", () => {
    expect(
      hostedSubscriptionAllowsUsage({
        plan: "pro",
        status: "past_due",
        monthlyIncludedSpendCents: 2_000,
        monthlyTokenLimit: null,
        onDemandEnabled: false,
        onDemandSpendCapCents: null,
      }),
    ).toBe(true);
  });
});
