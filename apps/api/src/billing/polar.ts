import type { BillingPort, HostedUsageIngestInput } from "@groxbot/adapter-kit";
import { USAGE_METER_HOSTED_TOKENS } from "@groxbot/contracts";
import {
  applyPolarCustomerState,
  loadBillingPlans,
  productIdForPlan,
  type PolarCustomerStateSnapshot,
} from "@groxbot/core";
import type { Database } from "@groxbot/db";
import { Polar } from "@polar-sh/sdk";
import type { CustomerState } from "@polar-sh/sdk/models/components/customerstate.js";
import type { Env } from "../env.js";
import { syncGatewayEntitlement } from "./gateway-entitlement.js";

function toSnapshot(state: CustomerState): PolarCustomerStateSnapshot {
  return {
    id: state.id,
    externalId: state.externalId,
    activeSubscriptions: state.activeSubscriptions.map((sub) => ({
      status: sub.status,
      productId: sub.productId,
      currentPeriodEnd: sub.currentPeriodEnd,
    })),
  };
}

export function createPolarClient(env: Env): Polar {
  return new Polar({
    accessToken: env.polarAccessToken ?? "",
    server: env.polarEnvironment === "production" ? "production" : "sandbox",
  });
}

export class PolarBillingPort implements BillingPort {
  constructor(
    private readonly db: Database,
    private readonly env: Env,
    private readonly polar = createPolarClient(env),
  ) {}

  enabled(): boolean {
    return Boolean(this.env.polarAccessToken?.trim());
  }

  async createCheckout(
    input: import("@groxbot/adapter-kit").BillingCheckoutInput,
  ): Promise<{ url: string }> {
    const catalog = await loadBillingPlans(this.db);
    const productId = productIdForPlan(catalog, input.plan);
    if (!productId) {
      throw new Error(`Polar product is not configured for plan ${input.plan}.`);
    }
    const checkout = await this.polar.checkouts.create({
      products: [productId],
      externalCustomerId: input.workspaceId,
      customerEmail: input.payerEmail,
      customerIpAddress: input.customerIpAddress,
      successUrl: input.successUrl,
      metadata: {
        workspaceId: input.workspaceId,
        payerUserId: input.payerUserId,
        plan: input.plan,
      },
    });
    if (!checkout.url) {
      throw new Error("Polar checkout did not return a URL.");
    }
    return { url: checkout.url };
  }

  async createPortalSession(
    input: import("@groxbot/adapter-kit").BillingPortalInput,
  ): Promise<{ url: string }> {
    const session = await this.polar.customerSessions.create({
      externalCustomerId: input.workspaceId,
      returnUrl: input.returnUrl ?? undefined,
    });
    if (!session.customerPortalUrl) {
      throw new Error("Polar customer portal did not return a URL.");
    }
    return { url: session.customerPortalUrl };
  }

  async refreshCustomerState(workspaceId: string): Promise<void> {
    try {
      const state = await this.polar.customers.getStateExternal({
        externalId: workspaceId,
      });
      await applyPolarCustomerState(
        this.db,
        workspaceId,
        toSnapshot(state),
      );
      await syncGatewayEntitlement(this.env, workspaceId, state);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Polar customer state failed";
      if (/not found/i.test(message)) return;
      throw error;
    }
  }

  async ingestHostedUsage(input: HostedUsageIngestInput): Promise<void> {
    if (!this.enabled()) return;
    await this.polar.events.ingest({
      events: [
        {
          name: USAGE_METER_HOSTED_TOKENS,
          externalCustomerId: input.workspaceId,
          externalId: input.usageId,
          externalMemberId: input.userId,
          metadata: {
            cost_cents: input.costCents,
            input_tokens: input.promptTokens,
            output_tokens: input.completionTokens,
            model: input.model,
          },
        },
      ],
    });
  }
}
