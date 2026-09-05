import {
  USAGE_BILLING_KIND_INCLUDED,
  USAGE_METER_COMPUTER_MINUTES,
} from "@groxbot/contracts";
import type { Database } from "@groxbot/db";
import { modelUsage } from "@groxbot/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { newId } from "./ids.js";
import { utcMonthStart } from "./billing.js";
import { HOSTED_USAGE_SOURCE } from "./usage.js";

/** Stored in model_usage.model for computer meter rows. */
export const COMPUTER_USAGE_MODEL = "computer";

/** Pi tool names that count as hosted computer time. */
export const COMPUTER_METER_TOOLS = new Set([
  "shell",
  "list",
  "read",
  "write",
  "edit",
  "delete",
  "find",
  "grep",
]);

export function isComputerMeterTool(name: string): boolean {
  return COMPUTER_METER_TOOLS.has(name.trim());
}

/** `model_usage.total_tokens` stores whole seconds for computer rows. */
export async function recordComputerUsage(
  db: Database,
  input: {
    workspaceId: string;
    userId: string;
    botId?: string | null;
    seconds: number;
  },
): Promise<void> {
  const seconds = Math.max(0, Math.trunc(input.seconds));
  if (seconds <= 0) return;
  await db.insert(modelUsage).values({
    id: newId(),
    workspaceId: input.workspaceId,
    userId: input.userId,
    botId: input.botId ?? null,
    runId: null,
    model: COMPUTER_USAGE_MODEL,
    source: HOSTED_USAGE_SOURCE,
    billingKind: USAGE_BILLING_KIND_INCLUDED,
    costCents: 0,
    meter: USAGE_METER_COMPUTER_MINUTES,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: seconds,
  });
}

export async function workspaceMonthlyComputerSeconds(
  db: Database,
  workspaceId: string,
  now = new Date(),
): Promise<number> {
  const since = utcMonthStart(now);
  const [row] = await db
    .select({
      seconds: sql<number>`cast(coalesce(sum(${modelUsage.totalTokens}), 0) as int)`,
    })
    .from(modelUsage)
    .where(
      and(
        eq(modelUsage.workspaceId, workspaceId),
        eq(modelUsage.meter, USAGE_METER_COMPUTER_MINUTES),
        gte(modelUsage.createdAt, since),
      ),
    );
  const seconds = row?.seconds;
  return typeof seconds === "number" && Number.isFinite(seconds)
    ? Math.max(0, Math.trunc(seconds))
    : 0;
}

export function computerSecondsToMinutes(seconds: number): number {
  const safe = Math.max(0, Math.trunc(seconds));
  if (safe === 0) return 0;
  return Math.ceil(safe / 60);
}
