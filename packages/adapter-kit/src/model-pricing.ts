/** Hosted model rate — cents per million tokens. Seeded in Postgres, not in source. */
export type ModelPricingQuote = {
  model: string;
  inputCentsPerMillion: number;
  outputCentsPerMillion: number;
};

/** Resolve hosted model pricing. KV on Worker; Postgres fallback. */
export interface ModelPricingPort {
  resolve(model: string): Promise<ModelPricingQuote | null>;
}
