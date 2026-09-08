import { describe, expect, it } from "vitest";
import { billingStatusLabel, formatUsdFromCents } from "./billing-format";

describe("formatUsdFromCents", () => {
  it("drops cents on whole dollars", () => {
    expect(formatUsdFromCents(0)).toBe("$0");
    expect(formatUsdFromCents(2000)).toBe("$20");
  });

  it("keeps cents when they matter", () => {
    expect(formatUsdFromCents(1)).toBe("$0.01");
    expect(formatUsdFromCents(2050)).toBe("$20.50");
  });
});

describe("billingStatusLabel", () => {
  it("hides empty Polar states", () => {
    expect(billingStatusLabel("")).toBeNull();
    expect(billingStatusLabel("none")).toBeNull();
  });

  it("titles common statuses", () => {
    expect(billingStatusLabel("active")).toBe("Active");
    expect(billingStatusLabel("trialing")).toBe("Trial");
    expect(billingStatusLabel("past_due")).toBe("Past due");
  });
});
