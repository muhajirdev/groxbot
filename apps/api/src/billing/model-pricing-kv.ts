import type { ModelPricingPort, ModelPricingQuote } from "@groxbot/adapter-kit";
import { loadAllModelPricing, type ModelPricingRow } from "@groxbot/core";
import type { Database } from "@groxbot/db";

export const MODEL_PRICING_KV_KEY = "model_pricing:v1";
/** Pricing changes rarely — long TTL; ops can delete the key after a seed. */
export const MODEL_PRICING_KV_TTL_SECONDS = 60 * 60;

type ModelPricingSnapshot = {
  rows: ModelPricingQuote[];
};

function rowToQuote(row: ModelPricingRow): ModelPricingQuote {
  return {
    model: row.model,
    inputCentsPerMillion: row.inputCentsPerMillion,
    outputCentsPerMillion: row.outputCentsPerMillion,
  };
}

function parseSnapshot(raw: string): ModelPricingSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as ModelPricingSnapshot;
    if (!parsed || !Array.isArray(parsed.rows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function lookup(snapshot: ModelPricingSnapshot, model: string): ModelPricingQuote | null {
  const trimmed = model.trim();
  if (!trimmed) return null;
  return snapshot.rows.find((row) => row.model === trimmed) ?? null;
}

export class KvModelPricingPort implements ModelPricingPort {
  constructor(
    private readonly kv: KVNamespace,
    private readonly db: Database,
  ) {}

  async resolve(model: string): Promise<ModelPricingQuote | null> {
    const trimmed = model.trim();
    if (!trimmed) return null;

    const cached = await this.kv.get(MODEL_PRICING_KV_KEY);
    if (cached) {
      const snapshot = parseSnapshot(cached);
      const hit = snapshot ? lookup(snapshot, trimmed) : null;
      if (hit) return hit;
    }

    const map = await loadAllModelPricing(this.db);
    const rows = [...map.values()].map(rowToQuote);
    await this.kv.put(
      MODEL_PRICING_KV_KEY,
      JSON.stringify({ rows }),
      { expirationTtl: MODEL_PRICING_KV_TTL_SECONDS },
    );
    const row = map.get(trimmed);
    return row ? rowToQuote(row) : null;
  }
}

export class DbModelPricingPort implements ModelPricingPort {
  constructor(private readonly db: Database) {}

  async resolve(model: string): Promise<ModelPricingQuote | null> {
    const map = await loadAllModelPricing(this.db);
    const row = map.get(model.trim());
    return row ? rowToQuote(row) : null;
  }
}

export function createModelPricingPort(
  kv: KVNamespace | undefined,
  db: Database,
): ModelPricingPort {
  if (kv) return new KvModelPricingPort(kv, db);
  return new DbModelPricingPort(db);
}

export async function invalidateModelPricingCache(
  kv: KVNamespace,
): Promise<void> {
  await kv.delete(MODEL_PRICING_KV_KEY);
}
