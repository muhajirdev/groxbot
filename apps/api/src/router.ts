import {
  appContract,
  labelForModel,
  SUGGESTED_STARTER_MODEL,
} from "@groxbot/contracts";
import {
  ComputerFileError,
  ComputerPathError,
  ComputerWriteError,
  encryptionSecret,
  getPokeThread,
  KnowledgeFileError,
  KnowledgePathError,
  KnowledgeWriteError,
  listEventsAfter,
  listWorkspaceApps,
  listWorkspaceMembers,
  loadModelSettings,
  ModelSettingsError,
  PokeError,
  publishedProfileImage,
  RoutineError,
  RoutineNotFoundError,
  RoutineScheduleError,
  SkillImportError,
  saveModelSettings,
  sleep,
  toBotDto,
  userHasModelCredentials,
} from "@groxbot/core";
import { guestConnectors, threads, userModelCredentials } from "@groxbot/db";
import { implement, ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { updateAccount } from "./account.js";
import {
  archiveBot,
  createBot,
  deleteBot,
  getBotThread,
  listBots,
  moveBot,
  pinBot,
  sendMessage,
  stopBotRuns,
  unarchiveBot,
  unpinBot,
  updateBot,
} from "./bots.js";
import type { RpcContext } from "./context.js";
import { agentRuntimeSource } from "./env.js";
import {
  connectorOnline,
  disableGuest,
  enableGuest,
  guestStatus,
  rotateGuest,
} from "./guests.js";
import { healthPayload } from "./health.js";
import { addMcp, connectMcp, listMcp, probeMcp, removeMcp } from "./mcp.js";
import {
  addPlugin,
  connectPlugin,
  disconnectPlugin,
  listPlugins,
  pluginStatus,
  refreshPlugins,
  removePlugin,
} from "./plugins.js";
import {
  createWorkspaceRoom,
  deleteWorkspaceRoom,
  getWorkspaceRoom,
  listWorkspaceRooms,
} from "./rooms.js";
import {
  createWorkspaceSection,
  listWorkspaceSections,
  removeWorkspaceSection,
  renameWorkspaceSection,
} from "./sections.js";
import {
  ensureDeploymentOwner,
  loadWorkspaceRef,
  requireActor,
  requireUser,
} from "./session.js";
import {
  activateWorkspace,
  createWorkspace,
  inviteToWorkspace,
  joinWorkspace,
  listWorkspaces,
  peekWorkspaceInvite,
  pendingInvitations,
  updateWorkspace,
} from "./workspaces.js";

const os = implement(appContract).$context<RpcContext>();

export const appRouter = os.router({
  health: os.health.handler(async ({ context }) => healthPayload(context.env)),
  me: os.me.handler(async ({ context }) => {
    const user = await requireUser(context);
    const isDeploymentOwner = await ensureDeploymentOwner(context, user.userId);
    if (!user.workspaceId) {
      return {
        userId: user.userId,
        email: user.email,
        name: user.name,
        image: user.image,
        workspaceId: null,
        workspaceSlug: null,
        workspaceName: null,
        needsWorkspace: true,
        isDeploymentOwner,
        needsModel: false,
        defaultModel: SUGGESTED_STARTER_MODEL,
        defaultModelLabel: labelForModel(SUGGESTED_STARTER_MODEL),
        modelWarning: null,
      };
    }
    const actor = {
      userId: user.userId,
      email: user.email,
      name: user.name,
      image: user.image,
      workspaceId: user.workspaceId,
      isDeploymentOwner,
    };
    const source = agentRuntimeSource(context.env);
    const secret = encryptionSecret(
      {
        ENCRYPTION_KEY: context.env.encryptionKey,
        BETTER_AUTH_SECRET: context.env.authSecret,
      },
      context.env.production,
    );
    const settings = await loadModelSettings(context.db, actor, source, secret);
    const creds = await context.db
      .select()
      .from(userModelCredentials)
      .where(eq(userModelCredentials.workspaceId, actor.workspaceId))
      .limit(1);
    const workspace = await loadWorkspaceRef(context, user);
    return {
      userId: actor.userId,
      email: actor.email,
      name: actor.name,
      image: actor.image,
      workspaceId: actor.workspaceId,
      workspaceSlug: workspace.slug,
      workspaceName: workspace.name,
      needsWorkspace: false,
      isDeploymentOwner,
      needsModel:
        !settings.hostedGateway && !userHasModelCredentials(creds.length),
      defaultModel: settings.defaultModelId,
      defaultModelLabel: labelForModel(settings.defaultModelId),
      modelWarning: settings.warning,
    };
  }),
  workspaces: {
    create: os.workspaces.create.handler(async ({ context, input }) => {
      const user = await requireUser(context);
      return createWorkspace(context, user, input.name);
    }),
    list: os.workspaces.list.handler(async ({ context }) => {
      const user = await requireUser(context);
      return listWorkspaces(context, user);
    }),
    activate: os.workspaces.activate.handler(async ({ context, input }) => {
      const user = await requireUser(context);
      return activateWorkspace(context, user, input.workspaceId);
    }),
    update: os.workspaces.update.handler(async ({ context, input }) => {
      return updateWorkspace(context, input.name);
    }),
    join: os.workspaces.join.handler(async ({ context, input }) => {
      const user = await requireUser(context);
      return joinWorkspace(context, user, input.invitationId);
    }),
    invite: os.workspaces.invite.handler(async ({ context, input }) => {
      return inviteToWorkspace(context, input.email);
    }),
    invitations: os.workspaces.invitations.handler(async ({ context }) => {
      const user = await requireUser(context);
      return pendingInvitations(context, user.email);
    }),
    peek: os.workspaces.peek.handler(async ({ context, input }) => {
      return peekWorkspaceInvite(context, input.invitationId);
    }),
    members: os.workspaces.members.handler(async ({ context }) => {
      const actor = await requireActor(context);
      const rows = await listWorkspaceMembers(
        context.db,
        actor.workspaceId,
        actor.userId,
      );
      const apiUrl = context.env.apiUrl ?? context.env.authUrl;
      return rows.map((row) => ({
        userId: row.userId,
        name: row.name,
        email: row.email,
        image: publishedProfileImage(
          row.image,
          row.userId,
          row.updatedAt?.getTime() ?? 0,
          apiUrl,
        ),
        role: row.role,
        mine: row.mine,
      }));
    }),
  },
  account: {
    update: os.account.update.handler(async ({ context, input }) => {
      return updateAccount(context, input);
    }),
  },
  models: {
    get: os.models.get.handler(async ({ context }) => {
      const actor = await requireActor(context);
      return loadModelSettings(
        context.db,
        actor,
        agentRuntimeSource(context.env),
        encryptionSecret(
          {
            ENCRYPTION_KEY: context.env.encryptionKey,
            BETTER_AUTH_SECRET: context.env.authSecret,
          },
          context.env.production,
        ),
      );
    }),
    save: os.models.save.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      try {
        return await saveModelSettings(
          context.db,
          actor,
          input,
          encryptionSecret(
            {
              ENCRYPTION_KEY: context.env.encryptionKey,
              BETTER_AUTH_SECRET: context.env.authSecret,
            },
            context.env.production,
          ),
          agentRuntimeSource(context.env),
        );
      } catch (caught) {
        if (caught instanceof ModelSettingsError) {
          throw new ORPCError("BAD_REQUEST", { message: caught.message });
        }
        throw caught;
      }
    }),
  },
  bots: {
    list: os.bots.list.handler(async ({ context }) => {
      const actor = await requireActor(context);
      return listBots(context, actor);
    }),
    get: os.bots.get.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      const { bot, thread } = await getBotThread(context, actor, input.botId);
      const [connector] = await context.db
        .select()
        .from(guestConnectors)
        .where(eq(guestConnectors.botId, bot.id))
        .limit(1);
      return toBotDto(bot, thread.id, {
        online: connector ? connectorOnline(connector) : false,
      });
    }),
    create: os.bots.create.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return createBot(context, actor, input);
    }),
    update: os.bots.update.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return updateBot(context, actor, input);
    }),
    archive: os.bots.archive.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return archiveBot(context, actor, input.botId);
    }),
    unarchive: os.bots.unarchive.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return unarchiveBot(context, actor, input.botId);
    }),
    pin: os.bots.pin.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return pinBot(context, actor, input.botId);
    }),
    unpin: os.bots.unpin.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return unpinBot(context, actor, input.botId);
    }),
    move: os.bots.move.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return moveBot(context, actor, input);
    }),
    delete: os.bots.delete.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return deleteBot(context, actor, input.botId);
    }),
  },
  sections: {
    list: os.sections.list.handler(async ({ context }) => {
      const actor = await requireActor(context);
      return listWorkspaceSections(context, actor);
    }),
    create: os.sections.create.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return createWorkspaceSection(context, actor, input);
    }),
    rename: os.sections.rename.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return renameWorkspaceSection(context, actor, input);
    }),
    remove: os.sections.remove.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return removeWorkspaceSection(context, actor, input.sectionId);
    }),
  },
  rooms: {
    list: os.rooms.list.handler(async ({ context }) => {
      const actor = await requireActor(context);
      return listWorkspaceRooms(context, actor);
    }),
    get: os.rooms.get.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return getWorkspaceRoom(context, actor, input.roomId);
    }),
    create: os.rooms.create.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return createWorkspaceRoom(context, actor, input);
    }),
    delete: os.rooms.delete.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return deleteWorkspaceRoom(context, actor, input.roomId);
    }),
  },
  threads: {
    subscribe: os.threads.subscribe.handler(async function* ({
      context,
      input,
      signal,
    }) {
      const actor = await requireActor(context);
      let threadId = input.threadId;
      if (threadId) {
        const [thread] = await context.db
          .select({ id: threads.id })
          .from(threads)
          .where(
            and(
              eq(threads.id, threadId),
              eq(threads.workspaceId, actor.workspaceId),
            ),
          )
          .limit(1);
        if (!thread) {
          throw new ORPCError("NOT_FOUND", { message: "Thread missing" });
        }
        threadId = thread.id;
      } else if (input.botId) {
        const found = await getBotThread(context, actor, input.botId);
        threadId = found.thread.id;
      } else {
        throw new ORPCError("BAD_REQUEST", {
          message: "botId or threadId is required",
        });
      }
      let cursor = input.cursor;
      while (!signal?.aborted) {
        const batch = await listEventsAfter(context.db, threadId, cursor);
        if (batch.length === 0) {
          await sleep(200, signal);
          continue;
        }
        for (const event of batch) {
          cursor = event.seq;
          yield event;
        }
      }
    }),
    get: os.threads.get.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      try {
        return await getPokeThread(
          context.db,
          actor.workspaceId,
          input.threadId,
        );
      } catch (error) {
        if (error instanceof PokeError) {
          throw new ORPCError("NOT_FOUND", { message: error.message });
        }
        throw error;
      }
    }),
    send: os.threads.send.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return sendMessage(context, actor, input.botId, input.text);
    }),
    stop: os.threads.stop.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      await stopBotRuns(context, actor, input.botId);
      return { ok: true as const };
    }),
  },
  apps: {
    list: os.apps.list.handler(async ({ context }) => {
      const actor = await requireActor(context);
      return listWorkspaceApps(context.db, actor.workspaceId);
    }),
  },
  guests: {
    status: os.guests.status.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return guestStatus(context, actor, input.botId);
    }),
    enable: os.guests.enable.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return enableGuest(context, actor, input.botId, input.kind);
    }),
    rotate: os.guests.rotate.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return rotateGuest(context, actor, input.botId);
    }),
    disable: os.guests.disable.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return disableGuest(context, actor, input.botId);
    }),
  },
  memory: {
    list: os.memory.list.handler(async ({ context }) => {
      await requireActor(context);
      return [];
    }),
  },
  plugins: {
    status: os.plugins.status.handler(async ({ context }) =>
      pluginStatus(context),
    ),
    list: os.plugins.list.handler(async ({ context }) => listPlugins(context)),
    add: os.plugins.add.handler(async ({ context, input }) =>
      addPlugin(context, input.toolkit),
    ),
    connect: os.plugins.connect.handler(async ({ context, input }) =>
      connectPlugin(context, input.toolkit),
    ),
    disconnect: os.plugins.disconnect.handler(async ({ context, input }) =>
      disconnectPlugin(context, input.toolkit),
    ),
    remove: os.plugins.remove.handler(async ({ context, input }) =>
      removePlugin(context, input.toolkit),
    ),
    refresh: os.plugins.refresh.handler(async ({ context }) =>
      refreshPlugins(context),
    ),
  },
  mcp: {
    list: os.mcp.list.handler(async ({ context }) => listMcp(context)),
    add: os.mcp.add.handler(async ({ context, input }) =>
      addMcp(context, input),
    ),
    connect: os.mcp.connect.handler(async ({ context, input }) =>
      connectMcp(context, input),
    ),
    remove: os.mcp.remove.handler(async ({ context, input }) =>
      removeMcp(context, input.id),
    ),
    probe: os.mcp.probe.handler(async ({ context, input }) =>
      probeMcp(context, input.id),
    ),
  },
  routines: {
    list: os.routines.list.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      await getBotThread(context, actor, input.botId);
      if (!context.routines) return [];
      try {
        return await context.routines.list(input.botId);
      } catch (error) {
        throwRoutineError(error);
      }
    }),
    create: os.routines.create.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      const { bot } = await getBotThread(context, actor, input.botId);
      if (bot.archivedAt) {
        throw new ORPCError("PRECONDITION_FAILED", {
          message: "This teammate is archived.",
        });
      }
      try {
        if (!context.routines) throw new RoutineError();
        return await context.routines.create(input.botId, {
          name: input.name,
          prompt: input.prompt,
          cron: input.cron,
          timezone: input.timezone,
        });
      } catch (error) {
        throwRoutineError(error);
      }
    }),
    pause: os.routines.pause.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      await getBotThread(context, actor, input.botId);
      try {
        if (!context.routines) throw new RoutineError();
        return await context.routines.pause(input.botId, input.id);
      } catch (error) {
        throwRoutineError(error);
      }
    }),
    resume: os.routines.resume.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      const { bot } = await getBotThread(context, actor, input.botId);
      if (bot.archivedAt) {
        throw new ORPCError("PRECONDITION_FAILED", {
          message: "This teammate is archived.",
        });
      }
      try {
        if (!context.routines) throw new RoutineError();
        return await context.routines.resume(input.botId, input.id);
      } catch (error) {
        throwRoutineError(error);
      }
    }),
    remove: os.routines.remove.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      await getBotThread(context, actor, input.botId);
      try {
        if (!context.routines) throw new RoutineError();
        await context.routines.remove(input.botId, input.id);
        return { ok: true as const };
      } catch (error) {
        throwRoutineError(error);
      }
    }),
  },
  knowledge: {
    list: os.knowledge.list.handler(async ({ context }) => {
      const actor = await requireActor(context);
      if (!context.knowledge) return { entries: [], truncated: false };
      try {
        return await context.knowledge.list(actor.workspaceId);
      } catch (error) {
        throwKnowledgeError(error);
      }
    }),
    read: os.knowledge.read.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      try {
        if (!context.knowledge) throw new KnowledgeFileError();
        return await context.knowledge.read(actor.workspaceId, input.path);
      } catch (error) {
        throwKnowledgeError(error);
      }
    }),
    download: os.knowledge.download.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      try {
        if (!context.knowledge) throw new KnowledgeFileError();
        return await context.knowledge.download(actor.workspaceId, input.path);
      } catch (error) {
        throwKnowledgeError(error);
      }
    }),
    backlinks: os.knowledge.backlinks.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      try {
        if (!context.knowledge) return { sources: [] };
        return await context.knowledge.backlinks(actor.workspaceId, input.path);
      } catch (error) {
        throwKnowledgeError(error);
      }
    }),
    graph: os.knowledge.graph.handler(async ({ context }) => {
      const actor = await requireActor(context);
      try {
        if (!context.knowledge) return { paths: [], out: [] };
        return await context.knowledge.graph(actor.workspaceId);
      } catch (error) {
        throwKnowledgeError(error);
      }
    }),
    write: os.knowledge.write.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      try {
        if (!context.knowledge) throw new KnowledgeWriteError();
        return await context.knowledge.write(actor.workspaceId, input);
      } catch (error) {
        throwKnowledgeError(error);
      }
    }),
    importSkill: os.knowledge.importSkill.handler(
      async ({ context, input }) => {
        const actor = await requireActor(context);
        try {
          if (!context.knowledge) {
            throw new SkillImportError("Knowledge is not configured.");
          }
          return await context.knowledge.importSkill(actor.workspaceId, input);
        } catch (error) {
          throwKnowledgeError(error);
        }
      },
    ),
    remove: os.knowledge.remove.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      try {
        if (!context.knowledge) throw new KnowledgeFileError();
        await context.knowledge.remove(actor.workspaceId, input.path);
        return { ok: true as const };
      } catch (error) {
        throwKnowledgeError(error);
      }
    }),
  },
  computer: {
    list: os.computer.list.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      await getBotThread(context, actor, input.botId);
      try {
        if (!context.computer) return { entries: [], truncated: false };
        return await context.computer.list(input.botId, input.path ?? "");
      } catch (error) {
        throwComputerError(error);
      }
    }),
    read: os.computer.read.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      await getBotThread(context, actor, input.botId);
      try {
        if (!context.computer) {
          throw new ComputerFileError();
        }
        return await context.computer.read(input.botId, input.path);
      } catch (error) {
        throwComputerError(error);
      }
    }),
    download: os.computer.download.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      await getBotThread(context, actor, input.botId);
      try {
        if (!context.computer) {
          throw new ComputerFileError();
        }
        return await context.computer.download(input.botId, input.path);
      } catch (error) {
        throwComputerError(error);
      }
    }),
    write: os.computer.write.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      await getBotThread(context, actor, input.botId);
      try {
        if (!context.computer?.write) {
          throw new ComputerWriteError();
        }
        return await context.computer.write(
          input.botId,
          input.filename,
          input.content,
          input.mediaType,
        );
      } catch (error) {
        throwComputerError(error);
      }
    }),
  },
});

function throwKnowledgeError(error: unknown): never {
  if (
    error instanceof KnowledgePathError ||
    error instanceof KnowledgeWriteError ||
    error instanceof SkillImportError
  ) {
    throw new ORPCError("BAD_REQUEST", { message: error.message });
  }
  if (error instanceof KnowledgeFileError) {
    throw new ORPCError("NOT_FOUND", { message: error.message });
  }
  throw error;
}

function throwComputerError(error: unknown): never {
  if (
    error instanceof ComputerPathError ||
    error instanceof ComputerWriteError
  ) {
    throw new ORPCError("BAD_REQUEST", { message: error.message });
  }
  if (error instanceof ComputerFileError) {
    throw new ORPCError("NOT_FOUND", { message: error.message });
  }
  throw error;
}

function throwRoutineError(error: unknown): never {
  if (error instanceof RoutineNotFoundError) {
    throw new ORPCError("NOT_FOUND", { message: error.message });
  }
  if (error instanceof RoutineScheduleError || error instanceof RoutineError) {
    throw new ORPCError("BAD_REQUEST", { message: error.message });
  }
  throw error;
}

export type AppRouter = typeof appRouter;
