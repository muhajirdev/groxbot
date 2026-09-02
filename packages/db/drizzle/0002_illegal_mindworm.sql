CREATE TABLE "mcp_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"host_bot_id" text,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"status" text NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD CONSTRAINT "mcp_connections_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD CONSTRAINT "mcp_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD CONSTRAINT "mcp_connections_host_bot_id_bots_id_fk" FOREIGN KEY ("host_bot_id") REFERENCES "public"."bots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_connections_workspace_name" ON "mcp_connections" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_connections_workspace_url" ON "mcp_connections" USING btree ("workspace_id","url");--> statement-breakpoint
CREATE INDEX "mcp_connections_host_bot_id" ON "mcp_connections" USING btree ("host_bot_id");