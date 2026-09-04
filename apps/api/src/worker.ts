/** Product API: Cloudflare Worker + Neon HTTP + Durable Object RoomActor. */
import { officeUserFromActor, withOfficeUserRequest } from "@groxbot/contracts";
import { createSkillImportHttp } from "@groxbot/core";
import { bots } from "@groxbot/db";
import { createNeonHttpDb } from "@groxbot/db/neon";
import { ORPCError } from "@orpc/server";
import { routeAgentRequest } from "agents";
import { and, eq, or } from "drizzle-orm";
import { createApp } from "./app.js";
import { AppRuntime, DurableObjectAppStore } from "./app-runtime-do.js";
import { type WorkerEnv } from "./bot-actor.js";
import {
  destroyBotActor,
  downloadBotComputer,
  listBotComputer,
  readBotComputer,
  writeBotComputer,
} from "./bot-computer.js";
import { enqueueOnActor } from "./bot-enqueue.js";
import { addBotMcp, oauthBotMcp, removeBotMcp } from "./bot-mcp.js";
import {
  createBotRoutine,
  listBotRoutines,
  pauseBotRoutine,
  removeBotRoutine,
  resumeBotRoutine,
  suspendBotRoutines,
} from "./bot-routines.js";
import { productEnv } from "./env.js";
import { knowledgeAccess } from "./knowledge.js";
import { r2KnowledgeDisk } from "./knowledge-r2.js";
import { RoomActor } from "./room-actor.js";
import { connectRoom, initRoomActor } from "./room-rpc.js";
import { actorForAgentBot, requireActor } from "./session.js";

export { CodemodeRuntime } from "@cloudflare/codemode";
export { WorkspaceServiceProxy } from "@cloudflare/computer";
export { AppRuntime, RoomActor, RoomActor as BotActor };

/** `/agents/{binding}/{name}` — instance name is the home room id. */
function agentInstanceName(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "agents" || parts.length < 3) return null;
  try {
    return decodeURIComponent(parts[2] ?? "");
  } catch {
    return parts[2] ?? null;
  }
}

async function homeRoomName(
  db: ReturnType<typeof createNeonHttpDb>["db"],
  botId: string,
): Promise<string> {
  const [bot] = await db
    .select({ homeRoomId: bots.homeRoomId })
    .from(bots)
    .where(eq(bots.id, botId))
    .limit(1);
  return bot?.homeRoomId || botId;
}

function agentCors(request: Request, origins: string[]): HeadersInit | true {
  const origin = request.headers.get("Origin");
  if (!origin || !origins.includes(origin)) return true;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
  };
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const loaded = productEnv(env);
    const { db, close } = createNeonHttpDb(loaded.databaseUrl);
    const apps = new DurableObjectAppStore(env.APP_RUNTIME);
    const onHome = (botId: string) => homeRoomName(db, botId);
    const handles = createApp(loaded, {
      db,
      close,
      enqueue: async (job) =>
        enqueueOnActor(env.ROOM_ACTOR, await onHome(job.botId), job),
      initApp: (appId, templateId, opts) => apps.init(appId, templateId, opts),
      connectApp: (appId, request, workspaceId) =>
        apps.connect(appId, request, workspaceId),
      connectRoom: (roomId, request, workspaceId) =>
        connectRoom(env.ROOM_ACTOR, roomId, request, workspaceId),
      initRoom: (roomId, opts) => initRoomActor(env.ROOM_ACTOR, roomId, opts),
      computer: {
        list: async (botId, path) =>
          listBotComputer(env.ROOM_ACTOR, await onHome(botId), path),
        read: async (botId, path) =>
          readBotComputer(env.ROOM_ACTOR, await onHome(botId), path),
        download: async (botId, path) =>
          downloadBotComputer(env.ROOM_ACTOR, await onHome(botId), path),
        write: async (botId, filename, content, mediaType) =>
          writeBotComputer(
            env.ROOM_ACTOR,
            await onHome(botId),
            filename,
            content,
            mediaType,
          ),
      },
      knowledge: env.KNOWLEDGE
        ? knowledgeAccess(
            r2KnowledgeDisk(env.KNOWLEDGE),
            createSkillImportHttp(),
          )
        : undefined,
      avatars: env.KNOWLEDGE ? r2KnowledgeDisk(env.KNOWLEDGE) : undefined,
      routines: {
        list: async (botId) =>
          listBotRoutines(env.ROOM_ACTOR, await onHome(botId)),
        create: async (botId, input) =>
          createBotRoutine(env.ROOM_ACTOR, await onHome(botId), input),
        pause: async (botId, id) =>
          pauseBotRoutine(env.ROOM_ACTOR, await onHome(botId), id),
        resume: async (botId, id) =>
          resumeBotRoutine(env.ROOM_ACTOR, await onHome(botId), id),
        remove: async (botId, id) =>
          removeBotRoutine(env.ROOM_ACTOR, await onHome(botId), id),
        suspend: async (botId, suspended) =>
          suspendBotRoutines(env.ROOM_ACTOR, await onHome(botId), suspended),
      },
      mcp: {
        add: async (botId, input) =>
          addBotMcp(env.ROOM_ACTOR, await onHome(botId), input),
        remove: async (botId, serverId) =>
          removeBotMcp(env.ROOM_ACTOR, await onHome(botId), serverId),
        oauth: async (botId, request) =>
          oauthBotMcp(env.ROOM_ACTOR, await onHome(botId), request),
      },
      forgetBot: (homeRoomId) => destroyBotActor(env.ROOM_ACTOR, homeRoomId),
      email: env.EMAIL,
    });

    const url = new URL(request.url);
    if (url.pathname.startsWith("/agents/")) {
      const pathname = url.pathname;
      let inbound = request;
      if (request.method !== "OPTIONS") {
        try {
          const botId = agentInstanceName(pathname);
          const messagesOnly = pathname.endsWith("/get-messages");
          const actor = botId
            ? await actorForAgentBot(
                { ...handles, headers: request.headers },
                botId,
              )
            : await requireActor({
                ...handles,
                headers: request.headers,
              });
          if (botId && !actor) {
            return new Response("Not found", { status: 404 });
          }
          if (!actor) {
            return new Response("Sign in", { status: 401 });
          }
          const officeUser = officeUserFromActor(actor);
          if (officeUser) inbound = withOfficeUserRequest(request, officeUser);
          if (botId && !messagesOnly && actor.workspaceId) {
            const [bot] = await db
              .select({ id: bots.id })
              .from(bots)
              .where(
                and(
                  or(eq(bots.id, botId), eq(bots.homeRoomId, botId)),
                  eq(bots.workspaceId, actor.workspaceId),
                ),
              )
              .limit(1);
            if (!bot) return new Response("Not found", { status: 404 });
          }
        } catch (error) {
          if (error instanceof ORPCError) {
            return new Response(error.message, { status: error.status });
          }
          throw error;
        }
      }
      const response =
        (await routeAgentRequest(inbound, env, {
          cors: agentCors(request, loaded.corsOrigins),
        })) || new Response("Not found", { status: 404 });
      return response;
    }

    return handles.app.fetch(request);
  },
};
