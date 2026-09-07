import {
  BILLING_INTERVAL_YEAR,
  WORKSPACE_PLAN_BELIEVERS,
  WORKSPACE_PLAN_PLUS,
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
      polarYearlyProductId: "prod_pro_year",
      rank: 1,
      monthlyIncludedSpendCents: 2000,
      monthlyTokenLimit: null,
    },
    {
      plan: WORKSPACE_PLAN_PLUS,
      label: "Pro Plus",
      polarProductId: "prod_plus",
      polarYearlyProductId: "prod_plus_year",
      rank: 2,
      monthlyIncludedSpendCents: 2000,
      monthlyTokenLimit: null,
    },
    {
      plan: WORKSPACE_PLAN_BELIEVERS,
      label: "Believers",
      polarProductId: "prod_believers",
      polarYearlyProductId: "prod_believers_year",
      rank: 3,
      monthlyIncludedSpendCents: 6000,
      monthlyTokenLimit: null,
    },
  ]);

  it("resolves polar product ids by plan", () => {
    expect(productIdForPlan(catalog, WORKSPACE_PLAN_PRO)).toBe("prod_pro");
    expect(productIdForPlan(catalog, WORKSPACE_PLAN_PLUS)).toBe("prod_plus");
    expect(productIdForPlan(catalog, WORKSPACE_PLAN_BELIEVERS)).toBe(
      "prod_believers",
    );
  });

  it("resolves yearly polar product ids", () => {
    expect(
      productIdForPlan(catalog, WORKSPACE_PLAN_PRO, BILLING_INTERVAL_YEAR),
    ).toBe("prod_pro_year");
    expect(
      productIdForPlan(catalog, WORKSPACE_PLAN_PLUS, BILLING_INTERVAL_YEAR),
    ).toBe("prod_plus_year");
  });

  it("indexes monthly and yearly polar product ids", () => {
    expect(catalog.byProductId.get("prod_plus")?.plan).toBe(
      WORKSPACE_PLAN_PLUS,
    );
    expect(catalog.byProductId.get("prod_plus_year")?.plan).toBe(
      WORKSPACE_PLAN_PLUS,
    );
  });
});
