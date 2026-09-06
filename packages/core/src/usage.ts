import {
  USAGE_BILLING_KIND_INCLUDED,
  USAGE_BILLING_KIND_ON_DEMAND,
  USAGE_METER_HOSTED_TOKENS,
  type UsageBillingKind,
  type UsageMeter,
} from "@groxbot/contracts";
import type { Database } from "@groxbot/db";
import { modelUsage } from "@groxbot/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { newId } from "./ids.js";
import { utcMonthStart } from "./billing.js";
import type { ModelPricingPort } from "@groxbot/adapter-kit";
import { incrementHostedUsageMirror } from "./usage-mirror.js";
import {
  estimateModelCostCents,
  resolveModelPricing,
  type ModelPricingRow,
  type PiUsageCost,
} from "./model-pricing.js";

export const HOSTED_USAGE_SOURCE = "hosted";

export type ModelUsageTotals = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type MonthlySpendTotals = {
  includedSpendCents: number;
  onDemandSpendCents: number;
};

export const emptyModelUsage: ModelUsageTotals = {
  requests: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

export const emptyMonthlySpend: MonthlySpendTotals = {
  includedSpendCents: 0,
  onDemandSpendCents: 0,
};

function asCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

export async function recordModelUsage(
  db: Database,
  input: {
    id?: string;
    workspaceId: string;
    userId: string;
    botId?: string | null;
    runId?: string | null;
    model: string;
    source?: string;
    billingKind?: UsageBillingKind;
    costCents?: number;
    meter?: UsageMeter | null;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  },
): Promise<string> {
  const promptTokens = asCount(input.promptTokens);
  const completionTokens = asCount(input.completionTokens);
  const totalTokens =
    asCount(input.totalTokens) || promptTokens + completionTokens;
  const costCents = asCount(input.costCents);
  if (
    promptTokens === 0 &&
    completionTokens === 0 &&
    totalTokens === 0 &&
    costCents === 0
  ) {
    return "";
  }
  const id = input.id ?? newId();
  await db.insert(modelUsage).values({
    id,
    workspaceId: input.workspaceId,
    userId: input.userId,
    botId: input.botId ?? null,
    runId: input.runId ?? null,
    model: input.model,
    source: input.source ?? HOSTED_USAGE_SOURCE,
    billingKind: input.billingKind ?? USAGE_BILLING_KIND_INCLUDED,
    costCents,
    meter: input.meter ?? USAGE_METER_HOSTED_TOKENS,
    promptTokens,
    completionTokens,
    totalTokens,
  });
  return id;
}

export type HostedModelUsageRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  botId: string | null;
  runId: string | null;
  model: string;
  billingKind: UsageBillingKind;
  costCents: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

/** Record hosted model usage with pricing from Postgres (or Pi cost metadata). */
export async function recordHostedModelUsage(
  db: Database,
  input: {
    workspaceId: string;
    userId: string;
    botId?: string | null;
    runId?: string | null;
    model: string;
    billingKind: UsageBillingKind;
    promptTokens: number;
    completionTokens: number;
    totalTokens?: number;
    piCost?: PiUsageCost | null;
    pricing?: ModelPricingPort;
  },
): Promise<HostedModelUsageRecord | null> {
  const promptTokens = asCount(input.promptTokens);
  const completionTokens = asCount(input.completionTokens);
  const totalTokens =
    asCount(input.totalTokens) || promptTokens + completionTokens;
  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) {
    return null;
  }
  const pricingRow = await resolveHostedModelPricing(
    db,
    input.model,
    input.pricing,
  );
  const costCents = estimateModelCostCents(
    promptTokens,
    completionTokens,
    pricingRow,
    input.piCost,
  );
  const id = await recordModelUsage(db, {
    workspaceId: input.workspaceId,
    userId: input.userId,
    botId: input.botId,
    runId: input.runId,
    model: input.model,
    billingKind: input.billingKind,
    costCents,
    promptTokens,
    completionTokens,
    totalTokens,
  });
  if (!id) return null;
  await incrementHostedUsageMirror(db, input.workspaceId, {
    billingKind: input.billingKind,
    costCents,
    totalTokens,
  });
  return {
    id,
    workspaceId: input.workspaceId,
    userId: input.userId,
    botId: input.botId ?? null,
    runId: input.runId ?? null,
    model: input.model,
    billingKind: input.billingKind,
    costCents,
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

async function resolveHostedModelPricing(
  db: Database,
  model: string,
  pricing?: ModelPricingPort,
): Promise<ModelPricingRow | null> {
  if (pricing) {
    const quote = await pricing.resolve(model);
    return quote;
  }
  return resolveModelPricing(db, model);
}

function usageWhere(
  workspaceId: string,
  since?: Date,
  billingKind?: UsageBillingKind,
) {
  return and(
    eq(modelUsage.workspaceId, workspaceId),
    eq(modelUsage.source, HOSTED_USAGE_SOURCE),
    ...(billingKind ? [eq(modelUsage.billingKind, billingKind)] : []),
    ...(since ? [gte(modelUsage.createdAt, since)] : []),
  );
}

export async function workspaceModelUsage(
  db: Database,
  workspaceId: string,
  opts?: { since?: Date; billingKind?: UsageBillingKind },
): Promise<ModelUsageTotals> {
  const [row] = await db
    .select({
      requests: sql<number>`cast(count(*) as int)`,
      promptTokens: sql<number>`cast(coalesce(sum(${modelUsage.promptTokens}), 0) as int)`,
      completionTokens: sql<number>`cast(coalesce(sum(${modelUsage.completionTokens}), 0) as int)`,
      totalTokens: sql<number>`cast(coalesce(sum(${modelUsage.totalTokens}), 0) as int)`,
    })
    .from(modelUsage)
    .where(usageWhere(workspaceId, opts?.since, opts?.billingKind));
  return {
    requests: asCount(row?.requests),
    promptTokens: asCount(row?.promptTokens),
    completionTokens: asCount(row?.completionTokens),
    totalTokens: asCount(row?.totalTokens),
  };
}

export async function workspaceMonthlySpend(
  db: Database,
  workspaceId: string,
  now = new Date(),
): Promise<MonthlySpendTotals> {
  const since = utcMonthStart(now);
  const [includedRow, onDemandRow] = await Promise.all([
    db
      .select({
        spendCents: sql<number>`cast(coalesce(sum(${modelUsage.costCents}), 0) as int)`,
      })
      .from(modelUsage)
      .where(
        usageWhere(workspaceId, since, USAGE_BILLING_KIND_INCLUDED),
      ),
    db
      .select({
        spendCents: sql<number>`cast(coalesce(sum(${modelUsage.costCents}), 0) as int)`,
      })
      .from(modelUsage)
      .where(
        usageWhere(workspaceId, since, USAGE_BILLING_KIND_ON_DEMAND),
      ),
  ]);
  return {
    includedSpendCents: asCount(includedRow[0]?.spendCents),
    onDemandSpendCents: asCount(onDemandRow[0]?.spendCents),
  };
}

export async function workspaceMonthlyModelUsage(
  db: Database,
  workspaceId: string,
  now = new Date(),
): Promise<ModelUsageTotals> {
  return workspaceModelUsage(db, workspaceId, { since: utcMonthStart(now) });
}

export async function workspaceMonthlyIncludedModelUsage(
  db: Database,
  workspaceId: string,
  now = new Date(),
): Promise<ModelUsageTotals> {
  return workspaceModelUsage(db, workspaceId, {
    since: utcMonthStart(now),
    billingKind: USAGE_BILLING_KIND_INCLUDED,
  });
}
