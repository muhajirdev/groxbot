import * as z from "zod";

/** Workspace plan slug mirrored from Polar / workspace_billing.plan */
export const WORKSPACE_PLAN_NONE = "none" as const;
export const WORKSPACE_PLAN_PRO = "pro" as const;
export const WORKSPACE_PLAN_PLUS = "plus" as const;
export const WORKSPACE_PLAN_BELIEVERS = "believers" as const;

/** Polar Pro checkout trial. Pro Plus and Believers have none. */
export const PRO_TRIAL_INTERVAL = "day" as const;
export const PRO_TRIAL_INTERVAL_COUNT = 3 as const;

export const BILLING_INTERVAL_MONTH = "month" as const;
export const BILLING_INTERVAL_YEAR = "year" as const;

export const BillingInterval = z.enum([
  BILLING_INTERVAL_MONTH,
  BILLING_INTERVAL_YEAR,
]);
export type BillingInterval = z.infer<typeof BillingInterval>;

/** List prices. Annual is 10 months (2 months free). */
export const WORKSPACE_PLAN_PRICE_USD = {
  [WORKSPACE_PLAN_PRO]: { month: 49, year: 490 },
  [WORKSPACE_PLAN_PLUS]: { month: 150, year: 1500 },
  [WORKSPACE_PLAN_BELIEVERS]: { month: 500, year: 5000 },
} as const;

/** Polar-hosted groxbot.com: office turns need a paid plan, including BYOK. */
export const WORKSPACE_PLAN_REQUIRED_MESSAGE =
  "Subscribe to Pro to use this workspace.";

export const WorkspacePlan = z.enum([
  WORKSPACE_PLAN_NONE,
  WORKSPACE_PLAN_PRO,
  WORKSPACE_PLAN_PLUS,
  WORKSPACE_PLAN_BELIEVERS,
]);
export type WorkspacePlan = z.infer<typeof WorkspacePlan>;

/** included = plan pool · on_demand = metered overage billed after the pool. */
export const USAGE_BILLING_KIND_INCLUDED = "included" as const;
export const USAGE_BILLING_KIND_ON_DEMAND = "on_demand" as const;

export const UsageBillingKind = z.enum([
  USAGE_BILLING_KIND_INCLUDED,
  USAGE_BILLING_KIND_ON_DEMAND,
]);
export type UsageBillingKind = z.infer<typeof UsageBillingKind>;

/** Polar / worker meter names. */
export const USAGE_METER_HOSTED_TOKENS = "hosted_tokens" as const;
export const USAGE_METER_COMPUTER_MINUTES = "computer_minutes" as const;

export const UsageMeter = z.enum([
  USAGE_METER_HOSTED_TOKENS,
  USAGE_METER_COMPUTER_MINUTES,
]);
export type UsageMeter = z.infer<typeof UsageMeter>;

export const BillingStatusSchema = z.object({
  enabled: z.boolean(),
  limitsEnforced: z.boolean(),
  plan: WorkspacePlan,
  status: z.string(),
  monthlyIncludedSpendCents: z.number().int().nullable(),
  monthlyTokenLimit: z.number().int().nullable(),
  onDemandEnabled: z.boolean(),
  onDemandSpendCapCents: z.number().int().nullable(),
  portalAvailable: z.boolean(),
  checkoutAvailable: z.boolean(),
  includedUsagePercent: z.number().int().min(0).max(100).nullable(),
  onDemandActive: z.boolean(),
  usage: z.object({
    periodStart: z.string(),
    includedSpendCents: z.number().int(),
    onDemandSpendCents: z.number().int(),
    includedTokens: z.number().int(),
    computerSeconds: z.number().int(),
    computerMinutes: z.number().int(),
  }),
});
export type BillingStatus = z.infer<typeof BillingStatusSchema>;

export const BillingCheckoutInputSchema = z.object({
  plan: WorkspacePlan.exclude(["none"]),
  interval: BillingInterval.default(BILLING_INTERVAL_MONTH),
});
export type BillingCheckoutInput = z.infer<typeof BillingCheckoutInputSchema>;

export const BillingCheckoutOutputSchema = z.object({
  url: z.string().url(),
});
export type BillingCheckoutOutput = z.infer<typeof BillingCheckoutOutputSchema>;

export const BillingPortalOutputSchema = z.object({
  url: z.string().url(),
});
export type BillingPortalOutput = z.infer<typeof BillingPortalOutputSchema>;

export const BillingOnDemandInputSchema = z.object({
  onDemandEnabled: z.boolean(),
  onDemandSpendCapCents: z.number().int().nullable().optional(),
});
export type BillingOnDemandInput = z.infer<typeof BillingOnDemandInputSchema>;
