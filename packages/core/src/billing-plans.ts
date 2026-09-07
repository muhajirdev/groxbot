import type { BillingInterval, WorkspacePlan } from "@groxbot/contracts";
import { BILLING_INTERVAL_YEAR } from "@groxbot/contracts";
import type { Database } from "@groxbot/db";
import { billingPlans } from "@groxbot/db";

export type BillingPlanConfig = {
  plan: WorkspacePlan;
  label: string;
  polarProductId: string | null;
  polarYearlyProductId: string | null;
  rank: number;
  monthlyIncludedSpendCents: number | null;
  monthlyTokenLimit: number | null;
};

export type BillingPlansCatalog = {
  plans: BillingPlanConfig[];
  byPlan: Map<WorkspacePlan, BillingPlanConfig>;
  byProductId: Map<string, BillingPlanConfig>;
};

function indexProductId(
  byProductId: Map<string, BillingPlanConfig>,
  productId: string | null | undefined,
  row: BillingPlanConfig,
) {
  const id = productId?.trim();
  if (id) byProductId.set(id, row);
}

export function buildBillingPlansCatalog(
  rows: BillingPlanConfig[],
): BillingPlansCatalog {
  const byPlan = new Map<WorkspacePlan, BillingPlanConfig>();
  const byProductId = new Map<string, BillingPlanConfig>();
  for (const row of rows) {
    byPlan.set(row.plan, row);
    indexProductId(byProductId, row.polarProductId, row);
    indexProductId(byProductId, row.polarYearlyProductId, row);
  }
  return { plans: rows, byPlan, byProductId };
}

export const emptyBillingPlansCatalog = buildBillingPlansCatalog([]);

export async function loadBillingPlans(db: Database): Promise<BillingPlansCatalog> {
  const rows = await db
    .select({
      plan: billingPlans.plan,
      label: billingPlans.label,
      polarProductId: billingPlans.polarProductId,
      polarYearlyProductId: billingPlans.polarYearlyProductId,
      rank: billingPlans.rank,
      monthlyIncludedSpendCents: billingPlans.monthlyIncludedSpendCents,
      monthlyTokenLimit: billingPlans.monthlyTokenLimit,
    })
    .from(billingPlans);
  return buildBillingPlansCatalog(
    rows.map((row) => ({
      plan: row.plan as WorkspacePlan,
      label: row.label,
      polarProductId: row.polarProductId,
      polarYearlyProductId: row.polarYearlyProductId,
      rank: row.rank,
      monthlyIncludedSpendCents: row.monthlyIncludedSpendCents,
      monthlyTokenLimit: row.monthlyTokenLimit,
    })),
  );
}

export function billingPlanConfig(
  catalog: BillingPlansCatalog,
  plan: WorkspacePlan,
): BillingPlanConfig | null {
  return catalog.byPlan.get(plan) ?? null;
}

export function productIdForPlan(
  catalog: BillingPlansCatalog,
  plan: Exclude<WorkspacePlan, "none">,
  interval: BillingInterval = "month",
): string | null {
  const row = catalog.byPlan.get(plan);
  const productId =
    interval === BILLING_INTERVAL_YEAR
      ? row?.polarYearlyProductId?.trim()
      : row?.polarProductId?.trim();
  return productId || null;
}
