ALTER TABLE "workspace_billing" ADD COLUMN "usage_period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_billing" ADD COLUMN "included_spend_cents_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_billing" ADD COLUMN "on_demand_spend_cents_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_billing" ADD COLUMN "included_tokens_used" integer DEFAULT 0 NOT NULL;