import type { Database } from "@groxbot/db";
import { modelPricing } from "@groxbot/db";

export type ModelPricingRow = {
  model: string;
  inputCentsPerMillion: number;
  outputCentsPerMillion: number;
};

export type PiUsageCost = {
  input?: number;
  output?: number;
  total?: number;
};

const PRICING_CACHE_TTL_MS = 5 * 60 * 1000;

let pricingCache: {
  loadedAt: number;
  byModel: Map<string, ModelPricingRow>;
} | null = null;

export function clearModelPricingCache(): void {
  pricingCache = null;
}

export async function loadAllModelPricing(
  db: Database,
): Promise<Map<string, ModelPricingRow>> {
  const rows = await db
    .select({
      model: modelPricing.model,
      inputCentsPerMillion: modelPricing.inputCentsPerMillion,
      outputCentsPerMillion: modelPricing.outputCentsPerMillion,
    })
    .from(modelPricing);
  return new Map(rows.map((row) => [row.model, row]));
}

export async function resolveModelPricing(
  db: Database,
  model: string,
  now = Date.now(),
): Promise<ModelPricingRow | null> {
  const trimmed = model.trim();
  if (!trimmed) return null;
  if (
    !pricingCache ||
    now - pricingCache.loadedAt > PRICING_CACHE_TTL_MS
  ) {
    pricingCache = {
      loadedAt: now,
      byModel: await loadAllModelPricing(db),
    };
  }
  return pricingCache.byModel.get(trimmed) ?? null;
}

export async function loadModelPricing(
  db: Database,
  model: string,
): Promise<ModelPricingRow | null> {
  return resolveModelPricing(db, model);
}

/** Estimate hosted model charge in cents (1/100 USD). */
export function estimateModelCostCents(
  promptTokens: number,
  completionTokens: number,
  pricing: ModelPricingRow | null,
  piCost?: PiUsageCost | null,
): number {
  const totalFromPi = piCost?.total;
  if (typeof totalFromPi === "number" && Number.isFinite(totalFromPi) && totalFromPi > 0) {
    return Math.max(0, Math.ceil(totalFromPi * 100));
  }
  if (!pricing) return 0;
  const input = Math.max(0, Math.trunc(promptTokens));
  const output = Math.max(0, Math.trunc(completionTokens));
  const numerator =
    input * pricing.inputCentsPerMillion +
    output * pricing.outputCentsPerMillion;
  if (numerator <= 0) return 0;
  return Math.max(1, Math.ceil(numerator / 1_000_000));
}
