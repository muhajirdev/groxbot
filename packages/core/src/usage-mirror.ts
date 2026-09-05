import {
  USAGE_BILLING_KIND_INCLUDED,
  USAGE_BILLING_KIND_ON_DEMAND,
  type UsageBillingKind,
} from "@groxbot/contracts";
import type { Database } from "@groxbot/db";
import { workspaceBilling } from "@groxbot/db";
import { eq, sql } from "drizzle-orm";
import {
  ensureWorkspaceBilling,
  type MonthlyUsageSnapshot,
  utcMonthStart,
} from "./billing.js";
import {
  workspaceMonthlyIncludedModelUsage,
  workspaceMonthlySpend,
} from "./usage.js";

export async function loadHostedUsageMonthly(
  db: Database,
  workspaceId: string,
  now = new Date(),
): Promise<MonthlyUsageSnapshot> {
  await ensureWorkspaceBilling(db, workspaceId);
  const periodStart = utcMonthStart(now);
  await db
    .update(workspaceBilling)
    .set({
      usagePeriodStart: periodStart,
      includedSpendCentsUsed: 0,
      onDemandSpendCentsUsed: 0,
      includedTokensUsed: 0,
      updatedAt: now,
    })
    .where(
      sql`${workspaceBilling.workspaceId} = ${workspaceId}
        AND (${workspaceBilling.usagePeriodStart} IS NULL
          OR ${workspaceBilling.usagePeriodStart} < ${periodStart})`,
    );

  const [row] = await db
    .select({
      includedSpendCentsUsed: workspaceBilling.includedSpendCentsUsed,
      onDemandSpendCentsUsed: workspaceBilling.onDemandSpendCentsUsed,
      includedTokensUsed: workspaceBilling.includedTokensUsed,
    })
    .from(workspaceBilling)
    .where(eq(workspaceBilling.workspaceId, workspaceId))
    .limit(1);

  const mirror: MonthlyUsageSnapshot = {
    includedSpendCents: row?.includedSpendCentsUsed ?? 0,
    onDemandSpendCents: row?.onDemandSpendCentsUsed ?? 0,
    includedTokens: row?.includedTokensUsed ?? 0,
  };

  const [spend, tokens] = await Promise.all([
    workspaceMonthlySpend(db, workspaceId, now),
    workspaceMonthlyIncludedModelUsage(db, workspaceId, now),
  ]);
  const aggregate: MonthlyUsageSnapshot = {
    includedSpendCents: spend.includedSpendCents,
    onDemandSpendCents: spend.onDemandSpendCents,
    includedTokens: tokens.totalTokens,
  };

  if (
    aggregate.includedSpendCents > mirror.includedSpendCents ||
    aggregate.onDemandSpendCents > mirror.onDemandSpendCents ||
    aggregate.includedTokens > mirror.includedTokens
  ) {
    await db
      .update(workspaceBilling)
      .set({
        usagePeriodStart: periodStart,
        includedSpendCentsUsed: aggregate.includedSpendCents,
        onDemandSpendCentsUsed: aggregate.onDemandSpendCents,
        includedTokensUsed: aggregate.includedTokens,
        updatedAt: now,
      })
      .where(eq(workspaceBilling.workspaceId, workspaceId));
    return aggregate;
  }

  return mirror;
}

export async function incrementHostedUsageMirror(
  db: Database,
  workspaceId: string,
  input: {
    billingKind: UsageBillingKind;
    costCents: number;
    totalTokens: number;
  },
  now = new Date(),
): Promise<void> {
  const periodStart = utcMonthStart(now);
  const includedCost =
    input.billingKind === USAGE_BILLING_KIND_INCLUDED
      ? Math.max(0, Math.trunc(input.costCents))
      : 0;
  const onDemandCost =
    input.billingKind === USAGE_BILLING_KIND_ON_DEMAND
      ? Math.max(0, Math.trunc(input.costCents))
      : 0;
  const includedTokens =
    input.billingKind === USAGE_BILLING_KIND_INCLUDED
      ? Math.max(0, Math.trunc(input.totalTokens))
      : 0;

  await db
    .update(workspaceBilling)
    .set({
      usagePeriodStart: periodStart,
      includedSpendCentsUsed: sql`CASE
        WHEN ${workspaceBilling.usagePeriodStart} IS NULL
          OR ${workspaceBilling.usagePeriodStart} < ${periodStart}
        THEN ${includedCost}
        ELSE ${workspaceBilling.includedSpendCentsUsed} + ${includedCost}
      END`,
      onDemandSpendCentsUsed: sql`CASE
        WHEN ${workspaceBilling.usagePeriodStart} IS NULL
          OR ${workspaceBilling.usagePeriodStart} < ${periodStart}
        THEN ${onDemandCost}
        ELSE ${workspaceBilling.onDemandSpendCentsUsed} + ${onDemandCost}
      END`,
      includedTokensUsed: sql`CASE
        WHEN ${workspaceBilling.usagePeriodStart} IS NULL
          OR ${workspaceBilling.usagePeriodStart} < ${periodStart}
        THEN ${includedTokens}
        ELSE ${workspaceBilling.includedTokensUsed} + ${includedTokens}
      END`,
      updatedAt: now,
    })
    .where(eq(workspaceBilling.workspaceId, workspaceId));
}
