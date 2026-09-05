import { describe, expect, it } from "vitest";
import { estimateModelCostCents } from "./model-pricing.js";

describe("estimateModelCostCents", () => {
  it("prefers pi usage cost when present", () => {
    expect(
      estimateModelCostCents(1000, 500, null, { total: 0.0125 }),
    ).toBe(2);
  });

  it("computes from per-million pricing", () => {
    expect(
      estimateModelCostCents(
        1_000_000,
        500_000,
        {
          model: "test",
          inputCentsPerMillion: 100,
          outputCentsPerMillion: 400,
        },
        null,
      ),
    ).toBe(300);
  });
});
