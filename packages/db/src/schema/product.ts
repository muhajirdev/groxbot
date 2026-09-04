import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth.js";

export const bots = pgTable(
  "bots",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    name: text("name").notNull(),
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    avatarColor: text("avatar_color").notNull().default("#5b7cff"),
    avatarShape: text("avatar_shape").notNull().default("circle"),
    parentBotId: text("parent_bot_id"),
    /** off | hermes | openclaw | generic. Default off = Groxbot runtime. */
    guestKind: text("guest_kind").notNull().default("off"),
    /** Empty = workspace default model from user_model_credentials. */
    model: text("model").notNull().default(""),
    /**
     * private = owner’s teammate. shared = office contact.
     * Existing rows default shared; new hires insert private.
     */
    visibility: text("visibility").notNull().default("shared"),
    /** Set when the teammate is archived (hidden + paused). Null = active. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /** Set when the teammate is pinned to the top of the sidebar. Null = unpinned. */
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    /** Named sidebar section. Null = ungrouped. */
    sectionId: text("section_id").references(
      (): AnyPgColumn => sidebarSections.id,
      { onDelete: "set null" },
    ),
    /** Sidebar office. Extra human↔bot threads for this bot are allowed; v1 never creates them. */
    homeThreadId: text("home_thread_id").references(
      (): AnyPgColumn => threads.id,
      { onDelete: "set null" },
    ),
    /** That bot’s own RoomActor (`rooms.id`). Instance name is this id, not bots.id. */
    homeRoomId: text("home_room_id").references((): AnyPgColumn => rooms.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("bots_home_thread_id_unique").on(t.homeThreadId),
    uniqueIndex("bots_home_room_id_unique").on(t.homeRoomId),
    index("bots_section_id").on(t.sectionId),
  ],
);

export const threads = pgTable(
  "threads",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** office = human↔bot (home or extra). poke = two bots talking. */
    kind: text("kind").notNull().default("office"),
    botId: text("bot_id").references(() => bots.id, { onDelete: "cascade" }),
    aBotId: text("a_bot_id").references(() => bots.id, { onDelete: "cascade" }),
    bBotId: text("b_bot_id").references(() => bots.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("threads_bot_id").on(t.botId),
    uniqueIndex("threads_poke_pair")
      .on(t.aBotId, t.bBotId)
      .where(sql`${t.kind} = 'poke'`),
  ],
);

/** v1: one human. Later: several humans in the same thread. */
export const threadMembers = pgTable(
  "thread_members",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("thread_members_thread_user").on(t.threadId, t.userId)],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    blocks: jsonb("blocks").notNull().$type<unknown[]>(),
    runId: text("run_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("messages_thread_seq").on(t.threadId, t.seq)],
);

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    botId: text("bot_id").notNull(),
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    runId: text("run_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("events_thread_seq").on(t.threadId, t.seq)],
);

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  botId: text("bot_id")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  threadId: text("thread_id")
    .notNull()
    .references(() => threads.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  prompt: text("prompt").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  botId: text("bot_id")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  threadId: text("thread_id")
    .notNull()
    .references(() => threads.id, { onDelete: "cascade" }),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  status: text("status").notNull(),
  trigger: text("trigger").notNull(),
  error: text("error"),
  leaseOwner: text("lease_owner"),
  leaseFence: integer("lease_fence").notNull().default(0),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const memoryDocuments = pgTable(
  "memory_documents",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    botId: text("bot_id"),
    scope: text("scope").notNull(),
    path: text("path").notNull(),
    content: text("content").notNull(),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("memory_workspace_scope_bot_path").on(
      t.workspaceId,
      t.scope,
      t.botId,
      t.path,
    ),
  ],
);

export const secrets = pgTable(
  "secrets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").notNull(),
    kind: text("kind").notNull(),
    ciphertext: text("ciphertext").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("secrets_workspace_kind").on(t.workspaceId, t.kind)],
);

/** Outbound guest (Hermes/OpenClaw) connector for one bot. Token shown once. */
export const guestConnectors = pgTable("guest_connectors", {
  id: text("id").primaryKey(),
  botId: text("bot_id")
    .notNull()
    .unique()
    .references(() => bots.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  tokenHash: text("token_hash").notNull(),
  online: boolean("online").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userModelCredentials = pgTable(
  "user_model_credentials",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").notNull(),
    provider: text("provider").notNull(),
    label: text("label").notNull(),
    secretId: text("secret_id").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    defaultModel: text("default_model"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("user_model_credentials_workspace_provider").on(
      t.workspaceId,
      t.provider,
    ),
  ],
);

/** Hosted Cloudflare AI Gateway usage. Counted per workspace; userId is for later per-person rollups. */
export const modelUsage = pgTable(
  "model_usage",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    botId: text("bot_id"),
    runId: text("run_id"),
    model: text("model").notNull(),
    source: text("source").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("model_usage_workspace_created").on(t.workspaceId, t.createdAt),
    index("model_usage_workspace_user").on(t.workspaceId, t.userId),
  ],
);

/** Workspace default model. Not a secret — keys live in `secrets`. */
export const workspaceModels = pgTable("workspace_models", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  defaultModel: text("default_model").notNull(),
  updatedBy: text("updated_by")
    .notNull()
    .references(() => user.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Composio toolkit connection for a workspace. Tokens stay at Composio. */
export const pluginConnections = pgTable(
  "plugin_connections",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    toolkit: text("toolkit").notNull(),
    status: text("status").notNull(),
    connectedAccountId: text("connected_account_id"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("plugin_connections_workspace_toolkit").on(
      t.workspaceId,
      t.toolkit,
    ),
  ],
);

/** Workspace remote MCP catalog. Live OAuth sits on one home actor; every teammate uses it. */
export const mcpConnections = pgTable(
  "mcp_connections",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    hostBotId: text("host_bot_id").references(() => bots.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    status: text("status").notNull(),
    /**
     * private = owner’s MCP. shared = office phone.
     * Existing rows default shared; new connections insert private.
     */
    visibility: text("visibility").notNull().default("shared"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("mcp_connections_workspace_shared_name")
      .on(t.workspaceId, t.name)
      .where(sql`${t.visibility} = 'shared'`),
    uniqueIndex("mcp_connections_workspace_owner_name")
      .on(t.workspaceId, t.userId, t.name)
      .where(sql`${t.visibility} = 'private'`),
    uniqueIndex("mcp_connections_workspace_shared_url")
      .on(t.workspaceId, t.url)
      .where(sql`${t.visibility} = 'shared'`),
    uniqueIndex("mcp_connections_workspace_owner_url")
      .on(t.workspaceId, t.userId, t.url)
      .where(sql`${t.visibility} = 'private'`),
    index("mcp_connections_host_bot_id").on(t.hostBotId),
  ],
);

/** Workspace catalog of places. Transcript lives on RoomActor, not here. */
export const rooms = pgTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("rooms_workspace_id").on(t.workspaceId)],
);

/** Bots seated at a room. Unique pair; the live log is on RoomActor. */
export const roomMembers = pgTable(
  "room_members",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("room_members_room_bot").on(t.roomId, t.botId),
    index("room_members_bot_id").on(t.botId),
  ],
);

/** Workspace-owned sidebar buckets for people. Not a room. */
export const sidebarSections = pgTable(
  "sidebar_sections",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sidebar_sections_workspace_id").on(t.workspaceId)],
);
