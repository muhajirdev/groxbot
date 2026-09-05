CREATE TABLE "knowledge_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"path" text NOT NULL,
	"kind" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "knowledge_shares" ADD CONSTRAINT "knowledge_shares_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_shares" ADD CONSTRAINT "knowledge_shares_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_shares_workspace_path_live" ON "knowledge_shares" USING btree ("workspace_id","path") WHERE "knowledge_shares"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "knowledge_shares_workspace_id" ON "knowledge_shares" USING btree ("workspace_id");