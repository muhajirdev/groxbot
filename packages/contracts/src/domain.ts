import * as z from "zod";
import {
  ActorType,
  AvatarShape,
  ControlHolder,
  GuestKind,
  Id,
  MemoryScope,
  RunStatus,
  SandboxKind,
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
  computerId: Id,
  computerName: z.string(),
  guestKind: GuestKind,
  guestOnline: z.boolean(),
  /** Empty = workspace default model. */
  model: z.string(),
  lastPreview: z.string(),
  lastAt: z.string(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Bot = z.infer<typeof BotSchema>;

export const CreateBotInput = z.object({
  name: z.string().min(1).max(80),
  /** Optional job line. Empty is fine — name is enough. */
  title: z.string().max(160).optional().default(""),
  description: z.string().max(4000).default(""),
  instructions: z.string().max(20000).default(""),
  avatarColor: z.string().max(32).default("#5b7cff"),
  avatarShape: AvatarShape.default("circle"),
  /** default = workspace default computer. new = isolated computer. id = bind to that computer. */
  computer: z
    .union([z.literal("default"), z.literal("new"), Id])
    .default("default"),
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

export const ComputerTeammateSchema = z.object({
  id: Id,
  name: z.string(),
});
export type ComputerTeammate = z.infer<typeof ComputerTeammateSchema>;

export const ComputerDeskFileSchema = z.object({
  path: z.string(),
  kind: z.enum(["file", "dir"]),
  title: z.string().optional(),
  body: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type ComputerDeskFile = z.infer<typeof ComputerDeskFileSchema>;

export const ComputerArtifactSchema = z.object({
  path: z.string(),
  title: z.string(),
  body: z.string(),
  updatedAt: z.string(),
});
export type ComputerArtifact = z.infer<typeof ComputerArtifactSchema>;

export const ComputerActivityItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.string(),
});
export type ComputerActivityItem = z.infer<typeof ComputerActivityItemSchema>;

export const ComputerStatusSchema = z.object({
  id: Id,
  name: z.string(),
  isDefault: z.boolean(),
  botId: Id,
  kind: SandboxKind,
  state: z.enum(["stopped", "booting", "running", "suspended", "error"]),
  controlHolder: ControlHolder,
  controlHolderId: Id.nullable(),
  usingBotId: Id.nullable(),
  usingBotName: z.string().nullable(),
  teammates: z.array(ComputerTeammateSchema),
  screenAvailable: z.boolean(),
  nowDoing: z.string().nullable(),
  files: z.array(ComputerDeskFileSchema),
  artifact: ComputerArtifactSchema.nullable(),
  activity: z.array(ComputerActivityItemSchema),
});
export type ComputerStatus = z.infer<typeof ComputerStatusSchema>;

export const ComputerListItemSchema = z.object({
  id: Id,
  name: z.string(),
  isDefault: z.boolean(),
  kind: SandboxKind,
  state: z.enum(["stopped", "booting", "running", "suspended", "error"]),
  agentCount: z.number().int(),
});
export type ComputerListItem = z.infer<typeof ComputerListItemSchema>;

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

export const MemoryDocumentSchema = z.object({
  id: Id,
  scope: MemoryScope,
  botId: Id.nullable(),
  path: z.string(),
  content: z.string(),
  revision: z.number().int(),
  updatedAt: z.string(),
});

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

export const JoinWorkspaceInput = z.object({
  invitationId: z.string().min(1).max(400),
});

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
