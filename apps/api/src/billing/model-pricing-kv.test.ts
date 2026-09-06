import { describe, expect, it, vi } from "vitest";
import {
  KvModelPricingPort,
  MODEL_PRICING_KV_KEY,
  MODEL_PRICING_KV_TTL_SECONDS,
} from "./model-pricing-kv.js";

function mockKv(store = new Map<string, string>()): KVNamespace {
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

describe("KvModelPricingPort", () => {
  it("reads from KV without hitting Postgres on cache hit", async () => {
    const kv = mockKv(
      new Map([
        [
          MODEL_PRICING_KV_KEY,
          JSON.stringify({
            rows: [
              {
                model: "anthropic/claude-sonnet-4",
                inputCentsPerMillion: 300,
                outputCentsPerMillion: 1500,
              },
            ],
          }),
        ],
      ]),
    );
    const db = {
      select: vi.fn(() => {
        throw new Error("db should not be queried on KV hit");
      }),
    };

    const port = new KvModelPricingPort(kv, db as never);
    const quote = await port.resolve("anthropic/claude-sonnet-4");

    expect(quote).toEqual({
      model: "anthropic/claude-sonnet-4",
      inputCentsPerMillion: 300,
      outputCentsPerMillion: 1500,
    });
    expect(kv.get).toHaveBeenCalledWith(MODEL_PRICING_KV_KEY);
  });

  it("loads Postgres and seeds KV on cache miss", async () => {
    const kv = mockKv();
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(async () => [
          {
            model: "openai/gpt-4.1",
            inputCentsPerMillion: 200,
            outputCentsPerMillion: 800,
          },
        ]),
      })),
    };

    const port = new KvModelPricingPort(kv, db as never);
    const quote = await port.resolve("openai/gpt-4.1");

    expect(quote?.model).toBe("openai/gpt-4.1");
    expect(kv.put).toHaveBeenCalledWith(
      MODEL_PRICING_KV_KEY,
      expect.stringContaining("openai/gpt-4.1"),
      { expirationTtl: MODEL_PRICING_KV_TTL_SECONDS },
    );
  });
});
