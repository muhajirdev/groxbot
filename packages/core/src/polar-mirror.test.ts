import {
  WORKSPACE_PLAN_BELIEVERS,
  WORKSPACE_PLAN_NONE,
  WORKSPACE_PLAN_PRO,
} from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { buildBillingPlansCatalog } from "./billing-plans.js";
import { workspaceBillingFromPolarState } from "./polar-mirror.js";

const catalog = buildBillingPlansCatalog([
  {
    plan: WORKSPACE_PLAN_PRO,
    label: "Pro",
    polarProductId: "prod_pro",
    rank: 1,
    monthlyIncludedSpendCents: 2000,
    monthlyTokenLimit: null,
  },
  {
    plan: WORKSPACE_PLAN_BELIEVERS,
    label: "Believers",
    polarProductId: "prod_believers",
    rank: 2,
    monthlyIncludedSpendCents: 6000,
    monthlyTokenLimit: null,
  },
]);

describe("workspaceBillingFromPolarState", () => {
  it("maps no active subscription to none", () => {
    const mirror = workspaceBillingFromPolarState(
      {
        id: "cus_1",
        externalId: "ws_1",
        activeSubscriptions: [],
      },
      catalog,
    );
    expect(mirror.plan).toBe(WORKSPACE_PLAN_NONE);
    expect(mirror.status).toBe("none");
  });

  it("prefers believers over pro", () => {
    const mirror = workspaceBillingFromPolarState(
      {
        id: "cus_1",
        externalId: "ws_1",
        activeSubscriptions: [
          {
            status: "active",
            productId: "prod_pro",
            currentPeriodEnd: "2026-10-01T00:00:00.000Z",
          },
          {
            status: "active",
            productId: "prod_believers",
            currentPeriodEnd: "2026-10-01T00:00:00.000Z",
          },
        ],
      },
      catalog,
    );
    expect(mirror.plan).toBe(WORKSPACE_PLAN_BELIEVERS);
    expect(mirror.monthlyIncludedSpendCents).toBe(6000);
  });

  it("maps pro subscription limits from billing_plans", () => {
    const mirror = workspaceBillingFromPolarState(
      {
        id: "cus_1",
        externalId: "ws_1",
        activeSubscriptions: [
          {
            status: "trialing",
            productId: "prod_pro",
            currentPeriodEnd: "2026-10-01T00:00:00.000Z",
          },
        ],
      },
      catalog,
    );
    expect(mirror.plan).toBe(WORKSPACE_PLAN_PRO);
    expect(mirror.status).toBe("trialing");
    expect(mirror.monthlyIncludedSpendCents).toBe(2000);
    expect(mirror.monthlyTokenLimit).toBeNull();
  });

  it("maps optional token limits from billing_plans", () => {
    const withTokens = buildBillingPlansCatalog([
      {
        plan: WORKSPACE_PLAN_PRO,
        label: "Pro",
        polarProductId: "prod_pro",
        rank: 1,
        monthlyIncludedSpendCents: 2000,
        monthlyTokenLimit: 500_000,
      },
    ]);
    const mirror = workspaceBillingFromPolarState(
      {
        id: "cus_1",
        externalId: "ws_1",
        activeSubscriptions: [
          {
            status: "active",
            productId: "prod_pro",
            currentPeriodEnd: "2026-10-01T00:00:00.000Z",
          },
        ],
      },
      withTokens,
    );
    expect(mirror.monthlyTokenLimit).toBe(500_000);
  });

  it("keeps past_due subscriptions on plan limits", () => {
    const mirror = workspaceBillingFromPolarState(
      {
        id: "cus_1",
        externalId: "ws_1",
        activeSubscriptions: [
          {
            status: "past_due",
            productId: "prod_pro",
            currentPeriodEnd: "2026-10-01T00:00:00.000Z",
          },
        ],
      },
      catalog,
    );
    expect(mirror.plan).toBe(WORKSPACE_PLAN_PRO);
    expect(mirror.status).toBe("past_due");
    expect(mirror.monthlyIncludedSpendCents).toBe(2000);
  });

  it("maps unknown product ids to none without limits", () => {
    const mirror = workspaceBillingFromPolarState(
      {
        id: "cus_1",
        externalId: "ws_1",
        activeSubscriptions: [
          {
            status: "active",
            productId: "prod_unknown",
            currentPeriodEnd: "2026-10-01T00:00:00.000Z",
          },
        ],
      },
      catalog,
    );
    expect(mirror.plan).toBe(WORKSPACE_PLAN_NONE);
    expect(mirror.monthlyIncludedSpendCents).toBeNull();
  });
});
