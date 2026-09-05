import {
  WORKSPACE_PLAN_BELIEVERS,
  WORKSPACE_PLAN_PRO,
} from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  buildBillingPlansCatalog,
  productIdForPlan,
} from "./billing-plans.js";

describe("billing plans catalog", () => {
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

  it("resolves polar product ids by plan", () => {
    expect(productIdForPlan(catalog, WORKSPACE_PLAN_PRO)).toBe("prod_pro");
    expect(productIdForPlan(catalog, WORKSPACE_PLAN_BELIEVERS)).toBe(
      "prod_believers",
    );
  });

  it("indexes plans by polar product id", () => {
    expect(catalog.byProductId.get("prod_believers")?.plan).toBe(
      WORKSPACE_PLAN_BELIEVERS,
    );
  });
});
