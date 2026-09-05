import { describe, expect, it, vi } from "vitest";
import { handlePolarWebhook } from "./webhooks.js";

vi.mock("@groxbot/core", () => ({
  applyPolarCustomerState: vi.fn(async () => undefined),
}));

vi.mock("./polar.js", () => ({
  createPolarClient: vi.fn(() => ({
    customers: {
      getStateExternal: vi.fn(async () => ({
        id: "cust_1",
        externalId: "ws_1",
        activeSubscriptions: [],
        activeMeters: [],
      })),
    },
  })),
}));

vi.mock("./gateway-entitlement.js", () => ({
  syncGatewayEntitlement: vi.fn(async () => undefined),
}));

vi.mock("@polar-sh/sdk/webhooks", () => ({
  WebhookVerificationError: class WebhookVerificationError extends Error {},
  validateEvent: vi.fn((_body, _headers, secret) => {
    if (secret !== "whsec_test") {
      throw new (class extends Error {})();
    }
    return {
      type: "customer.state_changed",
      data: {
        id: "cust_1",
        externalId: "ws_1",
        activeSubscriptions: [
          { status: "active", productId: "prod_1", currentPeriodEnd: null },
        ],
        activeMeters: [],
      },
    };
  }),
}));

describe("handlePolarWebhook", () => {
  it("mirrors customer.state_changed to Postgres and gateway KV", async () => {
    const { applyPolarCustomerState } = await import("@groxbot/core");
    const { syncGatewayEntitlement } = await import("./gateway-entitlement.js");

    await handlePolarWebhook(
      {} as never,
      {
        polarWebhookSecret: "whsec_test",
        groxGatewayUrl: "https://grox-gateway.example.com",
        groxGatewaySecret: "gw-secret",
      } as never,
      "{}",
      new Headers(),
    );

    expect(applyPolarCustomerState).toHaveBeenCalledOnce();
    expect(syncGatewayEntitlement).toHaveBeenCalledWith(
      expect.objectContaining({
        groxGatewayUrl: "https://grox-gateway.example.com",
      }),
      "ws_1",
      expect.objectContaining({ externalId: "ws_1" }),
    );
  });
});
