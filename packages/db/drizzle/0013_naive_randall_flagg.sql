CREATE TABLE "billing_plans" (
	"plan" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"polar_product_id" text,
	"rank" integer DEFAULT 0 NOT NULL,
	"monthly_included_spend_cents" integer,
	"monthly_token_limit" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
