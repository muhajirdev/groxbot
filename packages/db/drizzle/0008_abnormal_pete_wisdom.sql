DROP INDEX "mcp_connections_workspace_name";--> statement-breakpoint
DROP INDEX "mcp_connections_workspace_url";--> statement-breakpoint
ALTER TABLE "bots" ADD COLUMN "visibility" text DEFAULT 'shared' NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD COLUMN "visibility" text DEFAULT 'shared' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_connections_workspace_shared_name" ON "mcp_connections" USING btree ("workspace_id","name") WHERE "mcp_connections"."visibility" = 'shared';--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_connections_workspace_owner_name" ON "mcp_connections" USING btree ("workspace_id","user_id","name") WHERE "mcp_connections"."visibility" = 'private';--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_connections_workspace_shared_url" ON "mcp_connections" USING btree ("workspace_id","url") WHERE "mcp_connections"."visibility" = 'shared';--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_connections_workspace_owner_url" ON "mcp_connections" USING btree ("workspace_id","user_id","url") WHERE "mcp_connections"."visibility" = 'private';