import {
  USAGE_BILLING_KIND_INCLUDED,
  USAGE_BILLING_KIND_ON_DEMAND,
  WORKSPACE_PLAN_NONE,
  WorkspacePlan,
  type UsageBillingKind,
} from "@groxbot/contracts";
import type { Database } from "@groxbot/db";
import { workspaceBilling } from "@groxbot/db";
import { eq } from "drizzle-orm";
import {
  computerSecondsToMinutes,
  workspaceMonthlyComputerSeconds,
} from "./computer-usage.js";
import { loadHostedUsageMonthly } from "./usage-mirror.js";

export type WorkspaceBillingRow = {
  plan: string;
  status: string;
  monthlyIncludedSpendCents: number | null;
  monthlyTokenLimit: number | null;
  onDemandEnabled: boolean;
  onDemandSpendCapCents: number | null;
};

export type MonthlyUsageSnapshot = {
  includedSpendCents: number;
  onDemandSpendCents: number;
  includedTokens: number;
};

export type HostedUsageDecision =
  | typeof USAGE_BILLING_KIND_INCLUDED
  | typeof USAGE_BILLING_KIND_ON_DEMAND
  | "blocked";

export class UsageLimitExceededError extends Error {
  constructor(
    message = "This workspace hit its monthly hosted usage limit. Enable on-demand usage or upgrade your plan.",
  ) {
    super(message);
    this.name = "UsageLimitExceededError";
  }
}

/** Usage limits and checkout apply only after Polar is wired. Until then, track usage but do not block. */
export function billingLimitsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.POLAR_ACCESS_TOKEN?.trim());
}

export function billingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return billingLimitsEnabled(env);
}

export function utcMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function utcMonthStartIso(now = new Date()): string {
  return utcMonthStart(now).toISOString();
}

const HOSTED_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
]);

/** Paid plan with configured monthly limits — required for hosted usage when Polar is on. */
export function hostedSubscriptionAllowsUsage(
  billing: WorkspaceBillingRow,
): boolean {
  if (billing.plan === WORKSPACE_PLAN_NONE) return false;
  if (!HOSTED_SUBSCRIPTION_STATUSES.has(billing.status)) return false;
  const spendLimit = billing.monthlyIncludedSpendCents;
  if (spendLimit !== null && spendLimit > 0) return true;
  const tokenLimit = billing.monthlyTokenLimit;
  return tokenLimit !== null && tokenLimit > 0;
}

function includedPoolExhausted(
  billing: WorkspaceBillingRow,
  monthly: MonthlyUsageSnapshot,
): boolean {
  const spendLimit = billing.monthlyIncludedSpendCents;
  if (spendLimit !== null && spendLimit > 0) {
    return monthly.includedSpendCents >= spendLimit;
  }
  const tokenLimit = billing.monthlyTokenLimit;
  if (tokenLimit !== null && tokenLimit > 0) {
    return monthly.includedTokens >= tokenLimit;
  }
  return false;
}

function onDemandCapExceeded(
  billing: WorkspaceBillingRow,
  monthly: MonthlyUsageSnapshot,
): boolean {
  const cap = billing.onDemandSpendCapCents;
  return cap !== null && cap >= 0 && monthly.onDemandSpendCents >= cap;
}

/** Decide whether the next hosted run uses included pool, on-demand, or should be blocked. */
export function hostedUsageDecision(
  billing: WorkspaceBillingRow,
  monthly: MonthlyUsageSnapshot,
  opts?: { limitsEnforced?: boolean },
): HostedUsageDecision {
  if (opts?.limitsEnforced && !hostedSubscriptionAllowsUsage(billing)) {
    return "blocked";
  }
  if (!includedPoolExhausted(billing, monthly)) {
    return USAGE_BILLING_KIND_INCLUDED;
  }
  // Paid Polar subs keep going as metered overage. Optional spend cap still binds.
  if (hostedSubscriptionAllowsUsage(billing)) {
    if (onDemandCapExceeded(billing, monthly)) return "blocked";
    return USAGE_BILLING_KIND_ON_DEMAND;
  }
  if (!billing.onDemandEnabled) return "blocked";
  if (onDemandCapExceeded(billing, monthly)) return "blocked";
  return USAGE_BILLING_KIND_ON_DEMAND;
}

export function billingKindForDecision(
  decision: HostedUsageDecision,
): UsageBillingKind {
  if (decision === USAGE_BILLING_KIND_ON_DEMAND) {
    return USAGE_BILLING_KIND_ON_DEMAND;
  }
  return USAGE_BILLING_KIND_INCLUDED;
}

/** Customer-facing included usage (0–100). Null when there is no monthly cap. */
export function includedUsagePercent(
  billing: Pick<
    WorkspaceBillingRow,
    "monthlyIncludedSpendCents" | "monthlyTokenLimit"
  >,
  monthly: Pick<MonthlyUsageSnapshot, "includedSpendCents" | "includedTokens">,
): number | null {
  const spendLimit = billing.monthlyIncludedSpendCents;
  if (spendLimit !== null && spendLimit > 0) {
    return Math.min(
      100,
      Math.round((monthly.includedSpendCents / spendLimit) * 100),
    );
  }
  const tokenLimit = billing.monthlyTokenLimit;
  if (tokenLimit !== null && tokenLimit > 0) {
    return Math.min(
      100,
      Math.round((monthly.includedTokens / tokenLimit) * 100),
    );
  }
  return null;
}

export function onDemandUsageActive(
  billing: WorkspaceBillingRow,
  monthly: MonthlyUsageSnapshot,
): boolean {
  if (!includedPoolExhausted(billing, monthly)) return false;
  return (
    billing.onDemandEnabled || hostedSubscriptionAllowsUsage(billing)
  );
}

export async function getWorkspaceBilling(
  db: Database,
  workspaceId: string,
): Promise<WorkspaceBillingRow | null> {
  const [row] = await db
    .select({
      plan: workspaceBilling.plan,
      status: workspaceBilling.status,
      monthlyIncludedSpendCents: workspaceBilling.monthlyIncludedSpendCents,
      monthlyTokenLimit: workspaceBilling.monthlyTokenLimit,
      onDemandEnabled: workspaceBilling.onDemandEnabled,
      onDemandSpendCapCents: workspaceBilling.onDemandSpendCapCents,
    })
    .from(workspaceBilling)
    .where(eq(workspaceBilling.workspaceId, workspaceId))
    .limit(1);
  if (!row) return null;
  return row;
}

export async function ensureWorkspaceBilling(
  db: Database,
  workspaceId: string,
): Promise<WorkspaceBillingRow> {
  const existing = await getWorkspaceBilling(db, workspaceId);
  if (existing) return existing;
  const now = new Date();
  await db
    .insert(workspaceBilling)
    .values({
      workspaceId,
      plan: "none",
      status: "none",
      onDemandEnabled: false,
      updatedAt: now,
    })
    .onConflictDoNothing();
  return (
    (await getWorkspaceBilling(db, workspaceId)) ?? {
      plan: "none",
      status: "none",
      monthlyIncludedSpendCents: null,
      monthlyTokenLimit: null,
      onDemandEnabled: false,
      onDemandSpendCapCents: null,
    }
  );
}

export async function assertHostedUsageAllowed(
  db: Database,
  workspaceId: string,
  env: NodeJS.ProcessEnv,
  monthly?: MonthlyUsageSnapshot,
): Promise<HostedUsageDecision> {
  if (!billingLimitsEnabled(env)) {
    return USAGE_BILLING_KIND_INCLUDED;
  }
  const billing = await ensureWorkspaceBilling(db, workspaceId);
  const usage = monthly ?? (await loadHostedUsageMonthly(db, workspaceId));
  const limitsEnforced = billingLimitsEnabled(env);
  const decision = hostedUsageDecision(billing, usage, { limitsEnforced });
  if (decision === "blocked") {
    if (!hostedSubscriptionAllowsUsage(billing)) {
      throw new UsageLimitExceededError(
        "Subscribe to Pro or add your own model key to use hosted models.",
      );
    }
    throw new UsageLimitExceededError();
  }
  return decision;
}

export type BillingStatus = {
  enabled: boolean;
  limitsEnforced: boolean;
  plan: WorkspacePlan;
  status: string;
  monthlyIncludedSpendCents: number | null;
  monthlyTokenLimit: number | null;
  onDemandEnabled: boolean;
  onDemandSpendCapCents: number | null;
  portalAvailable: boolean;
  checkoutAvailable: boolean;
  /** 0–100 of monthly included hosted usage. Null when unlimited / no cap. */
  includedUsagePercent: number | null;
  /** Included cap exhausted and on-demand is enabled. */
  onDemandActive: boolean;
  usage: {
    periodStart: string;
    includedSpendCents: number;
    onDemandSpendCents: number;
    includedTokens: number;
    computerSeconds: number;
    computerMinutes: number;
  };
};

export async function loadBillingStatus(
  db: Database,
  workspaceId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<BillingStatus> {
  const enabled = billingEnabled(env);
  const billing = await ensureWorkspaceBilling(db, workspaceId);
  const [monthly, computerSeconds] = await Promise.all([
    loadHostedUsageMonthly(db, workspaceId),
    workspaceMonthlyComputerSeconds(db, workspaceId),
  ]);
  return {
    enabled,
    limitsEnforced: billingLimitsEnabled(env),
    plan: WorkspacePlan.parse(billing.plan),
    status: billing.status,
    monthlyIncludedSpendCents: billing.monthlyIncludedSpendCents,
    monthlyTokenLimit: billing.monthlyTokenLimit,
    onDemandEnabled: billing.onDemandEnabled,
    onDemandSpendCapCents: billing.onDemandSpendCapCents,
    portalAvailable: enabled,
    checkoutAvailable: enabled,
    includedUsagePercent: includedUsagePercent(billing, monthly),
    onDemandActive: onDemandUsageActive(billing, monthly),
    usage: {
      periodStart: utcMonthStartIso(),
      includedSpendCents: monthly.includedSpendCents,
      onDemandSpendCents: monthly.onDemandSpendCents,
      includedTokens: monthly.includedTokens,
      computerSeconds,
      computerMinutes: computerSecondsToMinutes(computerSeconds),
    },
  };
}

/** @deprecated Use assertHostedUsageAllowed with a full monthly snapshot. */
export async function assertWithinMonthlyTokenLimit(
  db: Database,
  workspaceId: string,
  env: NodeJS.ProcessEnv,
  usedTokens: number,
): Promise<void> {
  await assertHostedUsageAllowed(db, workspaceId, env, {
    includedSpendCents: 0,
    onDemandSpendCents: 0,
    includedTokens: usedTokens,
  });
}
