import { eventIterator, oc } from "@orpc/contract";
import * as z from "zod";
import {
  BotSchema,
  ComputerListItemSchema,
  ComputerStatusSchema,
  CreateBotInput,
  CreateWorkspaceInput,
  GuestConnectSchema,
  GuestStatusSchema,
  InviteWorkspaceInput,
  JoinWorkspaceInput,
  MemoryDocumentSchema,
  MeSchema,
  PluginConnectionSchema,
  PluginConnectResultSchema,
  PluginStatusSchema,
  PokeThreadSchema,
  RoutineSchema,
  ToolkitSlug,
  UpdateBotInput,
  WorkspaceInvitationSchema,
  WorkspaceInviteSchema,
  WorkspaceSchema,
} from "./domain.js";
import { ProductEventSchema } from "./events.js";
import { GuestAgentKind, Id } from "./ids.js";
import { ModelSettingsSchema, SaveModelSettingsInput } from "./models.js";

const botId = z.object({ botId: Id });

export const appContract = oc.router({
  health: oc.output(
    z.object({
      ok: z.literal(true),
      version: z.string(),
      runtime: z.string(),
      sandbox: z.string(),
      wakeup: z.string(),
      oauth: z.array(z.enum(["google", "github"])),
      mail: z.enum(["cloudflare", "log"]),
      composio: z.boolean(),
    }),
  ),
  me: oc.output(MeSchema),
  workspaces: {
    create: oc.input(CreateWorkspaceInput).output(WorkspaceSchema),
    join: oc.input(JoinWorkspaceInput).output(WorkspaceSchema),
    invite: oc.input(InviteWorkspaceInput).output(WorkspaceInviteSchema),
    invitations: oc.output(z.array(WorkspaceInvitationSchema)),
  },
  models: {
    get: oc.output(ModelSettingsSchema),
    save: oc.input(SaveModelSettingsInput).output(ModelSettingsSchema),
  },
  bots: {
    list: oc.output(z.array(BotSchema)),
    get: oc.input(botId).output(BotSchema),
    create: oc.input(CreateBotInput).output(BotSchema),
    update: oc.input(UpdateBotInput).output(BotSchema),
    archive: oc.input(botId).output(BotSchema),
    unarchive: oc.input(botId).output(BotSchema),
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
  computers: {
    list: oc.output(z.array(ComputerListItemSchema)),
  },
  computer: {
    status: oc.input(botId).output(ComputerStatusSchema),
    takeover: oc.input(botId).output(ComputerStatusSchema),
    release: oc.input(botId).output(ComputerStatusSchema),
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
  },
});

export type AppContract = typeof appContract;
