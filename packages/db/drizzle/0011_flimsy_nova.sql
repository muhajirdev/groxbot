CREATE TABLE "workspace_billing" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"plan" text DEFAULT 'none' NOT NULL,
	"status" text DEFAULT 'none' NOT NULL,
	"monthly_token_limit" integer,
	"polar_customer_id" text,
	"current_period_end" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_billing" ADD CONSTRAINT "workspace_billing_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_billing_polar_customer_id" ON "workspace_billing" USING btree ("polar_customer_id");