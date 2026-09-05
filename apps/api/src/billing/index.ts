import type { BillingPort } from "@groxbot/adapter-kit";
import { DisabledBillingPort } from "@groxbot/adapters";
import type { Database } from "@groxbot/db";
import type { Env } from "../env.js";
import { PolarBillingPort } from "./polar.js";

export function createBillingPort(db: Database, env: Env): BillingPort {
  if (!env.polarAccessToken?.trim()) {
    return new DisabledBillingPort();
  }
  return new PolarBillingPort(db, env);
}

export { PolarBillingPort } from "./polar.js";
export {
  createModelPricingPort,
  invalidateModelPricingCache,
  MODEL_PRICING_KV_KEY,
} from "./model-pricing-kv.js";
