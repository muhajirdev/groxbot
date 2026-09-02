import * as z from "zod";
import {
  ActorType,
  AvatarShape,
  GuestKind,
  Id,
  MemoryScope,
  RunStatus,
  TemplateId,
} from "./ids.js";

export const BotSchema = z.object({
  id: Id,
  workspaceId: Id,
  name: z.string(),
  title: z.string(),
  description: z.string(),
  instructions: z.string(),
  avatarColor: z.string(),
  avatarShape: AvatarShape,
  parentBotId: Id.nullable(),
  threadId: Id,
  guestKind: GuestKind,
  guestOnline: z.boolean(),
  /** Empty = workspace default model. */
  model: z.string(),
  lastPreview: z.string(),
  lastAt: z.string(),
  archivedAt: z.string().nullable(),
  pinnedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Bot = z.infer<typeof BotSchema>;

export const CreateBotInput = z.object({
  /** Client-generated id so the office can open the teammate before the insert returns. */
  id: Id.max(64).optional(),
  name: z.string().min(1).max(80),
  /** Optional job line. Empty is fine — name is enough. */
  title: z.string().max(160).optional().default(""),
  description: z.string().max(4000).default(""),
  instructions: z.string().max(20000).default(""),
  avatarColor: z.string().max(32).default("#5b7cff"),
  avatarShape: AvatarShape.default("circle"),
});

export const UpdateBotInput = z.object({
  botId: Id,
  name: z.string().min(1).max(80).optional(),
  title: z.string().max(160).optional(),
  description: z.string().max(4000).optional(),
  instructions: z.string().max(20000).optional(),
  avatarColor: z.string().max(32).optional(),
  avatarShape: AvatarShape.optional(),
  model: z.string().max(200).optional(),
});

/** Sidebar chrome. Identity still lives on the App Durable Object + chat card. */
export const WorkspaceAppSchema = z.object({
  id: Id,
  templateId: TemplateId,
  title: z.string(),
  createdAt: z.string(),
});
export type WorkspaceApp = z.infer<typeof WorkspaceAppSchema>;

export const MessageBlockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("meta"), text: z.string() }),
  z.object({
    kind: z.literal("poke_thread"),
    threadId: Id,
    peerBotId: Id,
    peerName: z.string(),
  }),
  z.object({
    kind: z.literal("app"),
    appId: Id,
    templateId: TemplateId,
    title: z.string(),
  }),
]);
export type MessageBlock = z.infer<typeof MessageBlockSchema>;

export const ThreadMessageSchema = z.object({
  id: Id,
  seq: z.number().int(),
  actorType: ActorType,
  actorId: Id.nullable(),
  blocks: z.array(MessageBlockSchema),
  runId: Id.nullable(),
  createdAt: z.string(),
});
export type ThreadMessage = z.infer<typeof ThreadMessageSchema>;

export const PokeThreadSchema = z.object({
  id: Id,
  kind: z.literal("poke"),
  bots: z.array(
    z.object({
      id: Id,
      name: z.string(),
      title: z.string(),
    }),
  ),
  messages: z.array(ThreadMessageSchema),
});
export type PokeThread = z.infer<typeof PokeThreadSchema>;

export const RunSchema = z.object({
  id: Id,
  botId: Id,
  threadId: Id,
  status: RunStatus,
  trigger: z.enum(["user", "routine", "resume", "follow_up", "spawn"]),
  error: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});
export type Run = z.infer<typeof RunSchema>;

export const RoutineSchema = z.object({
  id: Id,
  botId: Id,
  name: z.string(),
  prompt: z.string(),
  cron: z.string(),
  timezone: z.string(),
  active: z.boolean(),
  nextRunAt: z.string().nullable(),
});
export type Routine = z.infer<typeof RoutineSchema>;

/** Human-attached files land here on this bot’s Think workspace. */
export const COMPUTER_INBOX_DIR = "inbox";
export const MAX_COMPUTER_ATTACHMENTS = 6;
export const MAX_COMPUTER_WRITE_BYTES = 4 * 1024 * 1024;

/** One path on this bot’s Think workspace. Not a computers catalog. */
export const ComputerEntrySchema = z.object({
  path: z.string(),
  kind: z.enum(["file", "dir"]),
  size: z.number().int().nonnegative().optional(),
});
export type ComputerEntry = z.infer<typeof ComputerEntrySchema>;

export const ComputerListSchema = z.object({
  entries: z.array(ComputerEntrySchema),
  truncated: z.boolean(),
});
export type ComputerList = z.infer<typeof ComputerListSchema>;

export const ComputerFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  truncated: z.boolean(),
  encoding: z.enum(["text", "binary"]),
});
export type ComputerFile = z.infer<typeof ComputerFileSchema>;

/** Full file bytes as base64 for a browser download. Not the preview read. */
export const ComputerDownloadSchema = z.object({
  path: z.string(),
  filename: z.string(),
  content: z.string(),
  mediaType: z.string(),
});
export type ComputerDownload = z.infer<typeof ComputerDownloadSchema>;

export const MemoryDocumentSchema = z.object({
  id: Id,
  scope: MemoryScope,
  botId: Id.nullable(),
  path: z.string(),
  content: z.string(),
  revision: z.number().int(),
  updatedAt: z.string(),
});

/** One file in the office library. Folders are implied by path. */
export const KnowledgeEntrySchema = z.object({
  path: z.string(),
  name: z.string(),
  title: z.string(),
  description: z.string(),
  size: z.number().int().nonnegative().optional(),
  encoding: z.enum(["text", "binary"]),
  mediaType: z.string(),
});
export type KnowledgeEntry = z.infer<typeof KnowledgeEntrySchema>;

export const KnowledgeListSchema = z.object({
  entries: z.array(KnowledgeEntrySchema),
  truncated: z.boolean(),
});
export type KnowledgeList = z.infer<typeof KnowledgeListSchema>;

/** Interned office-link snapshot. Invert `out` in RAM; do not persist incoming. */
export const KnowledgeGraphSchema = z.object({
  paths: z.array(z.string()),
  out: z.array(z.array(z.number().int().nonnegative())),
});
export type KnowledgeGraph = z.infer<typeof KnowledgeGraphSchema>;

export const KnowledgeFileSchema = z.object({
  path: z.string(),
  title: z.string(),
  description: z.string(),
  content: z.string(),
  truncated: z.boolean(),
  encoding: z.enum(["text", "binary"]),
  mediaType: z.string(),
  backlinks: z.array(z.string()).default([]),
});
export type KnowledgeFile = z.infer<typeof KnowledgeFileSchema>;

export const KnowledgeWriteSchema = z.object({
  path: z.string().min(1).max(240),
  content: z.string().max(Math.ceil(MAX_COMPUTER_WRITE_BYTES * 1.4)),
  encoding: z.enum(["text", "base64"]).optional(),
  mediaType: z.string().max(127).optional(),
});
export type KnowledgeWrite = z.infer<typeof KnowledgeWriteSchema>;

export const KnowledgeImportInput = z.object({
  source: z.string().min(1).max(500),
  name: z.string().min(1).max(64).optional(),
});
export type KnowledgeImportInput = z.infer<typeof KnowledgeImportInput>;

export const KnowledgeImportResultSchema = z.object({
  imported: z.array(
    z.object({
      name: z.string(),
      path: z.string(),
      description: z.string(),
    }),
  ),
  skipped: z.array(
    z.object({
      name: z.string(),
      reason: z.string(),
    }),
  ),
});
export type KnowledgeImportResult = z.infer<typeof KnowledgeImportResultSchema>;

export const GuestStatusSchema = z.object({
  botId: Id,
  kind: GuestKind,
  online: z.boolean(),
  lastSeenAt: z.string().nullable(),
  connectUrl: z.string(),
});
export type GuestStatus = z.infer<typeof GuestStatusSchema>;

export const GuestConnectSchema = GuestStatusSchema.extend({
  token: z.string(),
  command: z.string(),
});
export type GuestConnect = z.infer<typeof GuestConnectSchema>;

export const WorkspaceSchema = z.object({
  id: Id,
  name: z.string(),
  slug: z.string(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const WorkspaceInvitationSchema = z.object({
  id: Id,
  email: z.string().email(),
  role: z.string(),
  organizationId: Id,
  organizationName: z.string(),
  expiresAt: z.string(),
});
export type WorkspaceInvitation = z.infer<typeof WorkspaceInvitationSchema>;

export const CreateWorkspaceInput = z.object({
  name: z.string().min(1).max(80),
});

export const UpdateWorkspaceInput = z.object({
  name: z.string().min(1).max(80),
});

export const JoinWorkspaceInput = z.object({
  invitationId: z.string().min(1).max(400),
});

export const WorkspaceInvitePeekSchema = z
  .object({
    email: z.string().email(),
    organizationName: z.string(),
    organizationId: Id,
  })
  .nullable();
export type WorkspaceInvitePeek = z.infer<typeof WorkspaceInvitePeekSchema>;

export const InviteWorkspaceInput = z.object({
  email: z.string().email(),
});

export const WorkspaceInviteSchema = z.object({
  id: Id,
  email: z.string().email(),
  url: z.string(),
});

export const ToolkitSlug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/);
export type ToolkitSlug = z.infer<typeof ToolkitSlug>;

export const PluginStatus = z.enum([
  "added",
  "connecting",
  "connected",
  "error",
]);
export type PluginStatus = z.infer<typeof PluginStatus>;

export const PluginConnectionSchema = z.object({
  id: Id,
  toolkit: ToolkitSlug,
  status: PluginStatus,
  connectedAccountId: z.string().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PluginConnection = z.infer<typeof PluginConnectionSchema>;

export const PluginConnectResultSchema = z.object({
  connection: PluginConnectionSchema,
  redirectUrl: z.string().nullable(),
});
export type PluginConnectResult = z.infer<typeof PluginConnectResultSchema>;

export const PluginStatusSchema = z.object({
  composio: z.boolean(),
});

export const McpName = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/);
export type McpName = z.infer<typeof McpName>;

export const McpUrl = z
  .string()
  .min(8)
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      if (url.protocol === "https:") return true;
      if (url.protocol !== "http:") return false;
      return (
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "::1"
      );
    } catch {
      return false;
    }
  }, "Paste an https MCP URL.");
export type McpUrl = z.infer<typeof McpUrl>;

export const McpConnectionSchema = z.object({
  id: Id,
  name: McpName,
  url: z.string(),
  status: PluginStatus,
  hostBotId: Id.nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type McpConnection = z.infer<typeof McpConnectionSchema>;

export const McpConnectResultSchema = z.object({
  connection: McpConnectionSchema,
  redirectUrl: z.string().nullable(),
});
export type McpConnectResult = z.infer<typeof McpConnectResultSchema>;

export const MeSchema = z.object({
  userId: Id,
  email: z.string().email(),
  name: z.string(),
  workspaceId: Id.nullable(),
  workspaceName: z.string().nullable(),
  needsWorkspace: z.boolean(),
  isDeploymentOwner: z.boolean(),
  needsModel: z.boolean(),
  defaultModel: z.string(),
  defaultModelLabel: z.string(),
  modelWarning: z.string().nullable(),
});
export type Me = z.infer<typeof MeSchema>;
