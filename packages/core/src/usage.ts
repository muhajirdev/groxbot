import type { Database } from "@groxbot/db";
import { modelUsage } from "@groxbot/db";
import { and, eq, sql } from "drizzle-orm";
import { newId } from "./ids.js";

export const HOSTED_USAGE_SOURCE = "hosted";

export type ModelUsageTotals = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export const emptyModelUsage: ModelUsageTotals = {
  requests: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

function asCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

export async function recordModelUsage(
  db: Database,
  input: {
    workspaceId: string;
    userId: string;
    botId?: string | null;
    runId?: string | null;
    model: string;
    source?: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  },
): Promise<void> {
  const promptTokens = asCount(input.promptTokens);
  const completionTokens = asCount(input.completionTokens);
  const totalTokens =
    asCount(input.totalTokens) || promptTokens + completionTokens;
  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) {
    return;
  }
  await db.insert(modelUsage).values({
    id: newId(),
    workspaceId: input.workspaceId,
    userId: input.userId,
    botId: input.botId ?? null,
    runId: input.runId ?? null,
    model: input.model,
    source: input.source ?? HOSTED_USAGE_SOURCE,
    promptTokens,
    completionTokens,
    totalTokens,
  });
}

export async function workspaceModelUsage(
  db: Database,
  workspaceId: string,
): Promise<ModelUsageTotals> {
  const [row] = await db
    .select({
      requests: sql<number>`cast(count(*) as int)`,
      promptTokens: sql<number>`cast(coalesce(sum(${modelUsage.promptTokens}), 0) as int)`,
      completionTokens: sql<number>`cast(coalesce(sum(${modelUsage.completionTokens}), 0) as int)`,
      totalTokens: sql<number>`cast(coalesce(sum(${modelUsage.totalTokens}), 0) as int)`,
    })
    .from(modelUsage)
    .where(
      and(
        eq(modelUsage.workspaceId, workspaceId),
        eq(modelUsage.source, HOSTED_USAGE_SOURCE),
      ),
    );
  return {
    requests: asCount(row?.requests),
    promptTokens: asCount(row?.promptTokens),
    completionTokens: asCount(row?.completionTokens),
    totalTokens: asCount(row?.totalTokens),
  };
}
