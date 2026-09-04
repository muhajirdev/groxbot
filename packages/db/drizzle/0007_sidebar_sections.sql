CREATE TABLE "sidebar_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bots" ADD COLUMN "section_id" text;--> statement-breakpoint
ALTER TABLE "sidebar_sections" ADD CONSTRAINT "sidebar_sections_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sidebar_sections_workspace_id" ON "sidebar_sections" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "bots" ADD CONSTRAINT "bots_section_id_sidebar_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sidebar_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bots_section_id" ON "bots" USING btree ("section_id");