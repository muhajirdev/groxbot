CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`issuer` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_issuer_account_id` ON `account` (`issuer`,`account_id`);--> statement-breakpoint
CREATE TABLE `deployment_settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`owner_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text,
	`status` text NOT NULL,
	`expires_at` integer NOT NULL,
	`inviter_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_org_user` ON `member` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`created_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_unique` ON `organization` (`slug`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`active_organization_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `billing_plans` (
	`plan` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`polar_product_id` text,
	`polar_yearly_product_id` text,
	`rank` integer DEFAULT 0 NOT NULL,
	`monthly_included_spend_cents` integer,
	`monthly_token_limit` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bots` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`avatar_color` text DEFAULT '#5b7cff' NOT NULL,
	`avatar_shape` text DEFAULT 'circle' NOT NULL,
	`parent_bot_id` text,
	`guest_kind` text DEFAULT 'off' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`effort` text DEFAULT '' NOT NULL,
	`visibility` text DEFAULT 'shared' NOT NULL,
	`archived_at` integer,
	`pinned_at` integer,
	`section_id` text,
	`home_thread_id` text,
	`home_room_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `sidebar_sections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`home_thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`home_room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bots_home_thread_id_unique` ON `bots` (`home_thread_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bots_home_room_id_unique` ON `bots` (`home_room_id`);--> statement-breakpoint
CREATE INDEX `bots_section_id` ON `bots` (`section_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`bot_id` text NOT NULL,
	`seq` integer NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`run_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_thread_seq` ON `events` (`thread_id`,`seq`);--> statement-breakpoint
CREATE TABLE `guest_connectors` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`token_hash` text NOT NULL,
	`online` integer DEFAULT false NOT NULL,
	`last_seen_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guest_connectors_bot_id_unique` ON `guest_connectors` (`bot_id`);--> statement-breakpoint
CREATE TABLE `knowledge_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`path` text NOT NULL,
	`kind` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_shares_workspace_path_live` ON `knowledge_shares` (`workspace_id`,`path`) WHERE "knowledge_shares"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX `knowledge_shares_workspace_id` ON `knowledge_shares` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `mcp_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`host_bot_id` text,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`status` text NOT NULL,
	`visibility` text DEFAULT 'shared' NOT NULL,
	`last_error` text,
	`oauth_ciphertext` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`host_bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_connections_workspace_shared_name` ON `mcp_connections` (`workspace_id`,`name`) WHERE "mcp_connections"."visibility" = 'shared';--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_connections_workspace_owner_name` ON `mcp_connections` (`workspace_id`,`user_id`,`name`) WHERE "mcp_connections"."visibility" = 'private';--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_connections_workspace_shared_url` ON `mcp_connections` (`workspace_id`,`url`) WHERE "mcp_connections"."visibility" = 'shared';--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_connections_workspace_owner_url` ON `mcp_connections` (`workspace_id`,`user_id`,`url`) WHERE "mcp_connections"."visibility" = 'private';--> statement-breakpoint
CREATE INDEX `mcp_connections_host_bot_id` ON `mcp_connections` (`host_bot_id`);--> statement-breakpoint
CREATE TABLE `memory_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`bot_id` text,
	`scope` text NOT NULL,
	`path` text NOT NULL,
	`content` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memory_workspace_scope_bot_path` ON `memory_documents` (`workspace_id`,`scope`,`bot_id`,`path`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`seq` integer NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`blocks` text NOT NULL,
	`run_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_thread_seq` ON `messages` (`thread_id`,`seq`);--> statement-breakpoint
CREATE TABLE `model_pricing` (
	`model` text PRIMARY KEY NOT NULL,
	`input_cents_per_million` integer DEFAULT 0 NOT NULL,
	`output_cents_per_million` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `model_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`bot_id` text,
	`run_id` text,
	`model` text NOT NULL,
	`source` text NOT NULL,
	`billing_kind` text DEFAULT 'included' NOT NULL,
	`cost_cents` integer DEFAULT 0 NOT NULL,
	`meter` text,
	`prompt_tokens` integer DEFAULT 0 NOT NULL,
	`completion_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `model_usage_workspace_created` ON `model_usage` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `model_usage_workspace_user` ON `model_usage` (`workspace_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `model_usage_workspace_billing_created` ON `model_usage` (`workspace_id`,`billing_kind`,`created_at`);--> statement-breakpoint
CREATE TABLE `plugin_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`toolkit` text NOT NULL,
	`status` text NOT NULL,
	`visibility` text DEFAULT 'shared' NOT NULL,
	`connected_account_id` text,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plugin_connections_workspace_id` ON `plugin_connections` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_connections_connected_account` ON `plugin_connections` (`connected_account_id`) WHERE "plugin_connections"."connected_account_id" is not null;--> statement-breakpoint
CREATE TABLE `room_members` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`bot_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_members_room_bot` ON `room_members` (`room_id`,`bot_id`);--> statement-breakpoint
CREATE INDEX `room_members_bot_id` ON `room_members` (`bot_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rooms_workspace_id` ON `rooms` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`bot_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`task_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`trigger` text NOT NULL,
	`error` text,
	`lease_owner` text,
	`lease_fence` integer DEFAULT 0 NOT NULL,
	`lease_expires_at` integer,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`ciphertext` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `secrets_workspace_kind` ON `secrets` (`workspace_id`,`kind`);--> statement-breakpoint
CREATE TABLE `sidebar_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sidebar_sections_workspace_id` ON `sidebar_sections` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`bot_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`prompt` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `thread_members` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `thread_members_thread_user` ON `thread_members` (`thread_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text DEFAULT 'office' NOT NULL,
	`bot_id` text,
	`a_bot_id` text,
	`b_bot_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`a_bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`b_bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `threads_bot_id` ON `threads` (`bot_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `threads_poke_pair` ON `threads` (`a_bot_id`,`b_bot_id`) WHERE "threads"."kind" = 'poke';--> statement-breakpoint
CREATE TABLE `user_model_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`provider` text NOT NULL,
	`label` text NOT NULL,
	`secret_id` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`default_model` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_model_credentials_workspace_provider` ON `user_model_credentials` (`workspace_id`,`provider`);--> statement-breakpoint
CREATE TABLE `workspace_billing` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`plan` text DEFAULT 'none' NOT NULL,
	`status` text DEFAULT 'none' NOT NULL,
	`monthly_included_spend_cents` integer,
	`monthly_token_limit` integer,
	`on_demand_enabled` integer DEFAULT false NOT NULL,
	`on_demand_spend_cap_cents` integer,
	`polar_customer_id` text,
	`current_period_end` integer,
	`usage_period_start` integer,
	`included_spend_cents_used` integer DEFAULT 0 NOT NULL,
	`on_demand_spend_cents_used` integer DEFAULT 0 NOT NULL,
	`included_tokens_used` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_billing_polar_customer_id` ON `workspace_billing` (`polar_customer_id`);--> statement-breakpoint
CREATE TABLE `workspace_models` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`default_model` text NOT NULL,
	`effort` text DEFAULT 'off' NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
