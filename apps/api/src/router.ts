import { isOfflineAgentRuntime } from "@groxbot/adapters/edge";
import {
  appContract,
  labelForModel,
  SUGGESTED_STARTER_MODEL,
} from "@groxbot/contracts";
import {
  encryptionSecret,
  getBotComputer,
  getPokeThread,
  listEventsAfter,
  loadModelSettings,
  ModelSettingsError,
  PokeError,
  saveModelSettings,
  sleep,
  toBotDto,
  userHasModelCredentials,
} from "@groxbot/core";
import { guestConnectors, threads, userModelCredentials } from "@groxbot/db";
import { implement, ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import {
  archiveBot,
  createBot,
  createRoutine,
  getBotThread,
  getComputer,
  listBots,
  listComputers,
  listRoutines,
  sendMessage,
  setComputerControl,
  stopBotRuns,
  unarchiveBot,
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
import {
  addPlugin,
  connectPlugin,
  disconnectPlugin,
  listPlugins,
  pluginStatus,
  refreshPlugins,
  removePlugin,
} from "./plugins.js";
import { requireActor, requireUser } from "./session.js";
import {
  createWorkspace,
  inviteToWorkspace,
  joinWorkspace,
  pendingInvitations,
} from "./workspaces.js";

const os = implement(appContract).$context<RpcContext>();

export const appRouter = os.router({
  health: os.health.handler(async ({ context }) => healthPayload(context.env)),
  me: os.me.handler(async ({ context }) => {
    const user = await requireUser(context);
    if (!user.workspaceId) {
      return {
        userId: user.userId,
        email: user.email,
        name: user.name,
        workspaceId: null,
        workspaceName: null,
        needsWorkspace: true,
        isDeploymentOwner: user.isDeploymentOwner,
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
      workspaceId: user.workspaceId,
      isDeploymentOwner: user.isDeploymentOwner,
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
    return {
      userId: actor.userId,
      email: actor.email,
      name: actor.name,
      workspaceId: actor.workspaceId,
      workspaceName: user.workspaceName,
      needsWorkspace: false,
      isDeploymentOwner: actor.isDeploymentOwner,
      needsModel:
        !isOfflineAgentRuntime(context.env.agentRuntime) &&
        !userHasModelCredentials(creds.length),
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
      const desk = await getBotComputer(context.db, bot);
      return toBotDto(bot, thread.id, {
        online: connector ? connectorOnline(connector) : false,
        computerName: desk?.name,
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
  computers: {
    list: os.computers.list.handler(async ({ context }) => {
      const actor = await requireActor(context);
      return listComputers(context, actor);
    }),
  },
  computer: {
    status: os.computer.status.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return getComputer(context, actor, input.botId);
    }),
    takeover: os.computer.takeover.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return setComputerControl(context, actor, input.botId, "user");
    }),
    release: os.computer.release.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return setComputerControl(context, actor, input.botId, "bot");
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
  routines: {
    list: os.routines.list.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return listRoutines(context, actor, input.botId);
    }),
    create: os.routines.create.handler(async ({ context, input }) => {
      const actor = await requireActor(context);
      return createRoutine(context, actor, input);
    }),
  },
});

export type AppRouter = typeof appRouter;
