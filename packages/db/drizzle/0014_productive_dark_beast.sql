CREATE TABLE "model_pricing" (
	"model" text PRIMARY KEY NOT NULL,
	"input_cents_per_million" integer DEFAULT 0 NOT NULL,
	"output_cents_per_million" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
