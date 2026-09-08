ALTER TABLE "bots" ADD COLUMN "effort" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_models" ADD COLUMN "effort" text DEFAULT 'off' NOT NULL;