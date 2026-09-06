DROP INDEX "plugin_connections_workspace_toolkit";--> statement-breakpoint
ALTER TABLE "plugin_connections" ADD COLUMN "visibility" text DEFAULT 'shared' NOT NULL;--> statement-breakpoint
CREATE INDEX "plugin_connections_workspace_id" ON "plugin_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_connections_connected_account" ON "plugin_connections" USING btree ("connected_account_id") WHERE "plugin_connections"."connected_account_id" is not null;