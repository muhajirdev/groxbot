/** Hosted model rate — cents per million tokens. Seeded in D1, not in source. */
export type ModelPricingQuote = {
  model: string;
  inputCentsPerMillion: number;
  outputCentsPerMillion: number;
};

/** Resolve hosted model pricing. KV on Worker; D1 fallback. */
export interface ModelPricingPort {
  resolve(model: string): Promise<ModelPricingQuote | null>;
}
