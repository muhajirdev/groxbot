import { eventIterator, oc } from "@orpc/contract";
import * as z from "zod";
import {
  AccountSchema,
  ActivateWorkspaceInput,
  BotSchema,
  ComputerDownloadSchema,
  ComputerFileSchema,
  ComputerListSchema,
  CreateBotInput,
  CreateRoomInput,
  CreateSidebarSectionInput,
  CreateWorkspaceInput,
  GuestConnectSchema,
  GuestStatusSchema,
  InviteWorkspaceInput,
  JoinWorkspaceInput,
  KnowledgeFileSchema,
  KnowledgeGraphSchema,
  KnowledgeImportInput,
  KnowledgeImportResultSchema,
  KnowledgeListSchema,
  KnowledgeSearchSchema,
  KnowledgeShareKind,
  KnowledgeShareSchema,
  KnowledgeWriteSchema,
  MAX_COMPUTER_WRITE_BYTES,
  McpConnectionSchema,
  McpConnectResultSchema,
  McpProbeResultSchema,
  MemoryDocumentSchema,
  MeSchema,
  MoveBotInput,
  PluginConnectionSchema,
  PluginConnectResultSchema,
  PluginStatusSchema,
  PokeThreadSchema,
  RenameSidebarSectionInput,
  RoomSchema,
  RoutineSchema,
  SidebarSectionSchema,
  ToolkitSlug,
  UpdateAccountInput,
  UpdateBotInput,
  UpdateWorkspaceInput,
  Visibility,
  WorkspaceAppSchema,
  WorkspaceInvitationSchema,
  WorkspaceInvitePeekSchema,
  WorkspaceInviteSchema,
  WorkspaceMemberSchema,
  WorkspaceSchema,
} from "./domain.js";
import { ProductEventSchema } from "./events.js";
import { GuestAgentKind, Id } from "./ids.js";
import {
  MailKind,
  ModelSettingsSchema,
  PRODUCT_RUNTIME,
  SaveModelSettingsInput,
  WakeupKind,
} from "./models.js";
import {
  BillingCheckoutInputSchema,
  BillingCheckoutOutputSchema,
  BillingOnDemandInputSchema,
  BillingPortalOutputSchema,
  BillingStatusSchema,
} from "./billing.js";

const botId = z.object({ botId: Id });

export const appContract = oc.router({
  health: oc.output(
    z.object({
      ok: z.literal(true),
      version: z.string(),
      runtime: z.literal(PRODUCT_RUNTIME),
      wakeup: WakeupKind,
      oauth: z.array(z.enum(["google", "github"])),
      mail: MailKind,
      composio: z.boolean(),
    }),
  ),
  me: oc.output(MeSchema),
  workspaces: {
    create: oc.input(CreateWorkspaceInput).output(WorkspaceSchema),
    list: oc.output(z.array(WorkspaceSchema)),
    activate: oc.input(ActivateWorkspaceInput).output(WorkspaceSchema),
    update: oc.input(UpdateWorkspaceInput).output(WorkspaceSchema),
    join: oc.input(JoinWorkspaceInput).output(WorkspaceSchema),
    invite: oc.input(InviteWorkspaceInput).output(WorkspaceInviteSchema),
    invitations: oc.output(z.array(WorkspaceInvitationSchema)),
    peek: oc.input(JoinWorkspaceInput).output(WorkspaceInvitePeekSchema),
    members: oc.output(z.array(WorkspaceMemberSchema)),
  },
  account: {
    update: oc.input(UpdateAccountInput).output(AccountSchema),
  },
  models: {
    get: oc.output(ModelSettingsSchema),
    save: oc.input(SaveModelSettingsInput).output(ModelSettingsSchema),
  },
  billing: {
    status: oc.output(BillingStatusSchema),
    checkout: oc
      .input(BillingCheckoutInputSchema)
      .output(BillingCheckoutOutputSchema),
    portal: oc.output(BillingPortalOutputSchema),
    updateOnDemand: oc
      .input(BillingOnDemandInputSchema)
      .output(BillingStatusSchema),
  },
  bots: {
    list: oc.output(z.array(BotSchema)),
    get: oc.input(botId).output(BotSchema),
    create: oc.input(CreateBotInput).output(BotSchema),
    update: oc.input(UpdateBotInput).output(BotSchema),
    archive: oc.input(botId).output(BotSchema),
    unarchive: oc.input(botId).output(BotSchema),
    pin: oc.input(botId).output(BotSchema),
    unpin: oc.input(botId).output(BotSchema),
    move: oc.input(MoveBotInput).output(BotSchema),
    delete: oc.input(botId).output(z.object({ ok: z.literal(true) })),
  },
  sections: {
    list: oc.output(z.array(SidebarSectionSchema)),
    create: oc.input(CreateSidebarSectionInput).output(SidebarSectionSchema),
    rename: oc.input(RenameSidebarSectionInput).output(SidebarSectionSchema),
    remove: oc
      .input(z.object({ sectionId: Id }))
      .output(z.object({ ok: z.literal(true) })),
  },
  rooms: {
    list: oc.output(z.array(RoomSchema)),
    get: oc.input(z.object({ roomId: Id })).output(RoomSchema),
    create: oc.input(CreateRoomInput).output(RoomSchema),
    delete: oc
      .input(z.object({ roomId: Id }))
      .output(z.object({ ok: z.literal(true) })),
  },
  threads: {
    subscribe: oc
      .input(
        z.object({
          botId: Id.optional(),
          threadId: Id.optional(),
          cursor: z.number().int().min(-1),
        }),
      )
      .output(eventIterator(ProductEventSchema)),
    get: oc.input(z.object({ threadId: Id })).output(PokeThreadSchema),
    send: oc
      .input(z.object({ botId: Id, text: z.string().min(1).max(8000) }))
      .output(z.object({ taskId: Id, runId: Id, seq: z.number().int() })),
    stop: oc.input(botId).output(z.object({ ok: z.literal(true) })),
  },
  apps: {
    /** Listing chrome from chat cards. Not load/save — the editor is the Durable Object. */
    list: oc.output(z.array(WorkspaceAppSchema)),
  },
  guests: {
    status: oc.input(botId).output(GuestStatusSchema),
    enable: oc
      .input(z.object({ botId: Id, kind: GuestAgentKind }))
      .output(GuestConnectSchema),
    rotate: oc.input(botId).output(GuestConnectSchema),
    disable: oc.input(botId).output(z.object({ ok: z.literal(true) })),
  },
  memory: {
    list: oc
      .input(z.object({ botId: Id.optional() }))
      .output(z.array(MemoryDocumentSchema)),
  },
  plugins: {
    status: oc.output(PluginStatusSchema),
    list: oc.output(z.array(PluginConnectionSchema)),
    add: oc
      .input(z.object({ toolkit: ToolkitSlug }))
      .output(PluginConnectionSchema),
    connect: oc
      .input(z.object({ toolkit: ToolkitSlug }))
      .output(PluginConnectResultSchema),
    disconnect: oc
      .input(z.object({ toolkit: ToolkitSlug }))
      .output(PluginConnectionSchema),
    remove: oc
      .input(z.object({ toolkit: ToolkitSlug }))
      .output(z.object({ ok: z.literal(true) })),
    refresh: oc.output(z.array(PluginConnectionSchema)),
  },
  mcp: {
    list: oc.output(z.array(McpConnectionSchema)),
    add: oc
      .input(
        z.object({
          botId: Id.optional(),
          name: z.string().min(1).max(80),
          url: z.string().min(8).max(500),
          visibility: Visibility.optional(),
        }),
      )
      .output(McpConnectResultSchema),
    connect: oc
      .input(z.object({ id: Id, botId: Id.optional() }))
      .output(McpConnectResultSchema),
    remove: oc
      .input(z.object({ id: Id }))
      .output(z.object({ ok: z.literal(true) })),
    probe: oc.input(z.object({ id: Id })).output(McpProbeResultSchema),
    update: oc
      .input(z.object({ id: Id, visibility: Visibility }))
      .output(McpConnectionSchema),
  },
  routines: {
    list: oc.input(botId).output(z.array(RoutineSchema)),
    create: oc
      .input(
        z.object({
          botId: Id,
          name: z.string().min(1).max(80),
          prompt: z.string().min(1).max(8000),
          cron: z.string().min(1).max(80),
          timezone: z.string().max(80).optional(),
        }),
      )
      .output(RoutineSchema),
    pause: oc.input(z.object({ botId: Id, id: Id })).output(RoutineSchema),
    resume: oc.input(z.object({ botId: Id, id: Id })).output(RoutineSchema),
    remove: oc
      .input(z.object({ botId: Id, id: Id }))
      .output(z.object({ ok: z.literal(true) })),
  },
  /** Workspace library on R2. One prefix per office. */
  knowledge: {
    list: oc.output(KnowledgeListSchema),
    search: oc
      .input(
        z.object({
          query: z.string().min(1).max(200),
          limit: z.number().int().min(1).max(12).optional(),
        }),
      )
      .output(KnowledgeSearchSchema),
    read: oc
      .input(z.object({ path: z.string().min(1).max(240) }))
      .output(KnowledgeFileSchema),
    download: oc
      .input(z.object({ path: z.string().min(1).max(240) }))
      .output(ComputerDownloadSchema),
    backlinks: oc
      .input(z.object({ path: z.string().min(1).max(240) }))
      .output(z.object({ sources: z.array(z.string()) })),
    graph: oc.output(KnowledgeGraphSchema),
    write: oc
      .input(KnowledgeWriteSchema)
      .output(z.object({ path: z.string() })),
    importSkill: oc
      .input(KnowledgeImportInput)
      .output(KnowledgeImportResultSchema),
    remove: oc
      .input(z.object({ path: z.string().min(1).max(240) }))
      .output(z.object({ ok: z.literal(true) })),
    shares: oc.output(z.array(KnowledgeShareSchema)),
    share: oc
      .input(
        z.object({
          path: z.string().min(1).max(240),
          kind: KnowledgeShareKind,
        }),
      )
      .output(KnowledgeShareSchema),
    unshare: oc
      .input(z.object({ shareId: Id }))
      .output(z.object({ ok: z.literal(true) })),
  },
  /** This bot’s Computer workspace. Not a computers catalog. */
  computer: {
    list: oc
      .input(z.object({ botId: Id, path: z.string().max(240).optional() }))
      .output(ComputerListSchema),
    read: oc
      .input(z.object({ botId: Id, path: z.string().min(1).max(240) }))
      .output(ComputerFileSchema),
    download: oc
      .input(z.object({ botId: Id, path: z.string().min(1).max(240) }))
      .output(ComputerDownloadSchema),
    write: oc
      .input(
        z.object({
          botId: Id,
          filename: z.string().min(1).max(120),
          content: z.string().max(Math.ceil(MAX_COMPUTER_WRITE_BYTES * 1.4)),
          mediaType: z.string().max(127).optional(),
        }),
      )
      .output(
        z.object({ path: z.string(), size: z.number().int().nonnegative() }),
      ),
  },
});

export type AppContract = typeof appContract;
