import type { WorkspacePlan } from "@groxbot/contracts";

export type BillingCheckoutPlan = Exclude<WorkspacePlan, "none">;

export type BillingCheckoutInput = {
  workspaceId: string;
  payerUserId: string;
  payerEmail: string;
  plan: BillingCheckoutPlan;
  successUrl: string;
  customerIpAddress?: string;
};

export type BillingPortalInput = {
  workspaceId: string;
  returnUrl?: string;
};

export type HostedUsageIngestInput = {
  usageId: string;
  workspaceId: string;
  userId: string;
  model: string;
  costCents: number;
  promptTokens: number;
  completionTokens: number;
};

/** Hosted checkout + portal. Polar SDK stays in apps/api — not on RoomActor. */
export interface BillingPort {
  enabled(): boolean;
  createCheckout(input: BillingCheckoutInput): Promise<{ url: string }>;
  createPortalSession(input: BillingPortalInput): Promise<{ url: string }>;
  refreshCustomerState(workspaceId: string): Promise<void>;
  ingestHostedUsage(input: HostedUsageIngestInput): Promise<void>;
}
