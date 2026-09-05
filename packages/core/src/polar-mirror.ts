import {
  WORKSPACE_PLAN_NONE,
  type WorkspacePlan,
} from "@groxbot/contracts";
import type { Database } from "@groxbot/db";
import { workspaceBilling } from "@groxbot/db";
import { eq } from "drizzle-orm";
import {
  type BillingPlansCatalog,
  loadBillingPlans,
} from "./billing-plans.js";

export type PolarSubscriptionSnapshot = {
  status: string;
  productId: string;
  currentPeriodEnd: Date | string;
};

export type PolarCustomerStateSnapshot = {
  id: string;
  externalId?: string | null;
  activeSubscriptions: PolarSubscriptionSnapshot[];
};

const SUBSCRIPTION_LIMIT_STATUSES = new Set(["active", "trialing", "past_due"]);

export type WorkspaceBillingMirror = {
  polarCustomerId: string;
  plan: WorkspacePlan;
  status: string;
  monthlyIncludedSpendCents: number | null;
  monthlyTokenLimit: number | null;
  currentPeriodEnd: Date | null;
};

export function workspaceBillingFromPolarState(
  state: PolarCustomerStateSnapshot,
  catalog: BillingPlansCatalog,
): WorkspaceBillingMirror {
  const active = state.activeSubscriptions.filter((sub) =>
    SUBSCRIPTION_LIMIT_STATUSES.has(sub.status),
  );
  let best: PolarSubscriptionSnapshot | null = null;
  let bestRank = -1;
  for (const sub of active) {
    const plan = catalog.byProductId.get(sub.productId);
    const rank = plan?.rank ?? -1;
    if (rank > bestRank) {
      bestRank = rank;
      best = sub;
    } else if (rank === bestRank && rank >= 0 && best) {
      const nextEnd = new Date(sub.currentPeriodEnd).getTime();
      const currentEnd = new Date(best.currentPeriodEnd).getTime();
      if (nextEnd > currentEnd) best = sub;
    }
  }

  if (!best || bestRank < 0) {
    return {
      polarCustomerId: state.id,
      plan: WORKSPACE_PLAN_NONE,
      status: "none",
      monthlyIncludedSpendCents: null,
      monthlyTokenLimit: null,
      currentPeriodEnd: null,
    };
  }

  const planConfig = catalog.byProductId.get(best.productId);
  if (!planConfig) {
    return {
      polarCustomerId: state.id,
      plan: WORKSPACE_PLAN_NONE,
      status: best.status,
      monthlyIncludedSpendCents: null,
      monthlyTokenLimit: null,
      currentPeriodEnd: null,
    };
  }

  const plan = planConfig.plan;
  const currentPeriodEnd = new Date(best.currentPeriodEnd);
  return {
    polarCustomerId: state.id,
    plan,
    status: best.status,
    monthlyIncludedSpendCents: planConfig.monthlyIncludedSpendCents,
    monthlyTokenLimit: planConfig.monthlyTokenLimit,
    currentPeriodEnd: Number.isNaN(currentPeriodEnd.getTime())
      ? null
      : currentPeriodEnd,
  };
}

export async function applyPolarCustomerState(
  db: Database,
  workspaceId: string,
  state: PolarCustomerStateSnapshot,
): Promise<void> {
  const catalog = await loadBillingPlans(db);
  const mirror = workspaceBillingFromPolarState(state, catalog);
  const now = new Date();
  await db
    .insert(workspaceBilling)
    .values({
      workspaceId,
      polarCustomerId: mirror.polarCustomerId,
      plan: mirror.plan,
      status: mirror.status,
      monthlyIncludedSpendCents: mirror.monthlyIncludedSpendCents,
      monthlyTokenLimit: mirror.monthlyTokenLimit,
      currentPeriodEnd: mirror.currentPeriodEnd,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: workspaceBilling.workspaceId,
      set: {
        polarCustomerId: mirror.polarCustomerId,
        plan: mirror.plan,
        status: mirror.status,
        monthlyIncludedSpendCents: mirror.monthlyIncludedSpendCents,
        monthlyTokenLimit: mirror.monthlyTokenLimit,
        currentPeriodEnd: mirror.currentPeriodEnd,
        updatedAt: now,
      },
    });
}

export async function updateWorkspaceOnDemand(
  db: Database,
  workspaceId: string,
  input: {
    onDemandEnabled: boolean;
    onDemandSpendCapCents: number | null;
  },
): Promise<void> {
  await db
    .update(workspaceBilling)
    .set({
      onDemandEnabled: input.onDemandEnabled,
      onDemandSpendCapCents: input.onDemandSpendCapCents,
      updatedAt: new Date(),
    })
    .where(eq(workspaceBilling.workspaceId, workspaceId));
}
