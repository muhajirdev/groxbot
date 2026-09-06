import type {
  BillingCheckoutInput,
  BillingPort,
  BillingPortalInput,
  HostedUsageIngestInput,
} from "@groxbot/adapter-kit";

export class DisabledBillingPort implements BillingPort {
  enabled(): boolean {
    return false;
  }

  async createCheckout(_input: BillingCheckoutInput): Promise<{ url: string }> {
    throw new Error("Billing is not configured on this deployment.");
  }

  async createPortalSession(
    _input: BillingPortalInput,
  ): Promise<{ url: string }> {
    throw new Error("Billing is not configured on this deployment.");
  }

  async refreshCustomerState(_workspaceId: string): Promise<void> {}

  async ingestHostedUsage(_input: HostedUsageIngestInput): Promise<void> {}
}

export class FakeBillingPort implements BillingPort {
  readonly checkouts: BillingCheckoutInput[] = [];
  readonly portals: BillingPortalInput[] = [];
  readonly refreshes: string[] = [];
  readonly ingests: HostedUsageIngestInput[] = [];

  constructor(
    private readonly urls: {
      checkout?: string;
      portal?: string;
    } = {},
  ) {}

  enabled(): boolean {
    return true;
  }

  async createCheckout(input: BillingCheckoutInput): Promise<{ url: string }> {
    this.checkouts.push(input);
    return { url: this.urls.checkout ?? "https://checkout.test/session" };
  }

  async createPortalSession(
    input: BillingPortalInput,
  ): Promise<{ url: string }> {
    this.portals.push(input);
    return { url: this.urls.portal ?? "https://portal.test/session" };
  }

  async refreshCustomerState(workspaceId: string): Promise<void> {
    this.refreshes.push(workspaceId);
  }

  async ingestHostedUsage(input: HostedUsageIngestInput): Promise<void> {
    this.ingests.push(input);
  }
}
