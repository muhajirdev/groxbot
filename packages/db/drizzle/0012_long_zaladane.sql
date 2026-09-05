ALTER TABLE "model_usage" ADD COLUMN "billing_kind" text DEFAULT 'included' NOT NULL;--> statement-breakpoint
ALTER TABLE "model_usage" ADD COLUMN "cost_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "model_usage" ADD COLUMN "meter" text;--> statement-breakpoint
ALTER TABLE "workspace_billing" ADD COLUMN "monthly_included_spend_cents" integer;--> statement-breakpoint
ALTER TABLE "workspace_billing" ADD COLUMN "on_demand_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_billing" ADD COLUMN "on_demand_spend_cap_cents" integer;--> statement-breakpoint
CREATE INDEX "model_usage_workspace_billing_created" ON "model_usage" USING btree ("workspace_id","billing_kind","created_at");