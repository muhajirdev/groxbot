import { describe, expect, it } from "vitest";
import { DisabledBillingPort, FakeBillingPort } from "./billing.js";

describe("DisabledBillingPort", () => {
  it("reports disabled and refuses checkout", async () => {
    const billing = new DisabledBillingPort();
    expect(billing.enabled()).toBe(false);
    await expect(
      billing.createCheckout({
        workspaceId: "ws_1",
        payerUserId: "u_1",
        payerEmail: "a@example.com",
        plan: "pro",
        successUrl: "https://app.test/settings",
      }),
    ).rejects.toThrow(/not configured/i);
  });
});

describe("FakeBillingPort", () => {
  it("records checkout input", async () => {
    const billing = new FakeBillingPort();
    const result = await billing.createCheckout({
      workspaceId: "ws_1",
      payerUserId: "u_1",
      payerEmail: "a@example.com",
      plan: "believers",
      successUrl: "https://app.test/settings",
    });
    expect(result.url).toContain("checkout.test");
    expect(billing.checkouts[0]?.plan).toBe("believers");
  });
});
