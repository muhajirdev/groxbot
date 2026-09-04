/** Product API: Cloudflare Worker + Neon HTTP + Durable Object BotActor. */
import { officeUserFromActor, withOfficeUserRequest } from "@groxbot/contracts";
import { createSkillImportHttp } from "@groxbot/core";
import { bots } from "@groxbot/db";
import { createNeonHttpDb } from "@groxbot/db/neon";
import { ORPCError } from "@orpc/server";
import { routeAgentRequest } from "agents";
import { and, eq } from "drizzle-orm";
import { createApp } from "./app.js";
import { AppRuntime, DurableObjectAppStore } from "./app-runtime-do.js";
import { BotActor, type WorkerEnv } from "./bot-actor.js";
import {
  destroyBotActor,
  downloadBotComputer,
  listBotComputer,
  readBotComputer,
  writeBotComputer,
} from "./bot-computer.js";
import { enqueueOnBot } from "./bot-enqueue.js";
import { addBotMcp, oauthBotMcp, removeBotMcp } from "./bot-mcp.js";
import { connectBotOffice } from "./bot-office-rpc.js";
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
export { AppRuntime, BotActor, RoomActor };

/** `/agents/{binding}/{botId}` — instance name is the bot id. */
function agentInstanceName(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "agents" || parts.length < 3) return null;
  try {
    return decodeURIComponent(parts[2] ?? "");
  } catch {
    return parts[2] ?? null;
  }
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
    const handles = createApp(loaded, {
      db,
      close,
      enqueue: (job) => enqueueOnBot(env.BOT_ACTOR, job),
      initApp: (appId, templateId, opts) => apps.init(appId, templateId, opts),
      connectApp: (appId, request, workspaceId) =>
        apps.connect(appId, request, workspaceId),
      connectBot: (botId, request, workspaceId) =>
        connectBotOffice(env.BOT_ACTOR, botId, request, workspaceId),
      connectRoom: (roomId, request, workspaceId) =>
        connectRoom(env.ROOM_ACTOR, roomId, request, workspaceId),
      initRoom: (roomId, opts) => initRoomActor(env.ROOM_ACTOR, roomId, opts),
      computer: {
        list: (botId, path) => listBotComputer(env.BOT_ACTOR, botId, path),
        read: (botId, path) => readBotComputer(env.BOT_ACTOR, botId, path),
        download: (botId, path) =>
          downloadBotComputer(env.BOT_ACTOR, botId, path),
        write: (botId, filename, content, mediaType) =>
          writeBotComputer(env.BOT_ACTOR, botId, filename, content, mediaType),
      },
      knowledge: env.KNOWLEDGE
        ? knowledgeAccess(
            r2KnowledgeDisk(env.KNOWLEDGE),
            createSkillImportHttp(),
          )
        : undefined,
      avatars: env.KNOWLEDGE ? r2KnowledgeDisk(env.KNOWLEDGE) : undefined,
      routines: {
        list: (botId) => listBotRoutines(env.BOT_ACTOR, botId),
        create: (botId, input) => createBotRoutine(env.BOT_ACTOR, botId, input),
        pause: (botId, id) => pauseBotRoutine(env.BOT_ACTOR, botId, id),
        resume: (botId, id) => resumeBotRoutine(env.BOT_ACTOR, botId, id),
        remove: (botId, id) => removeBotRoutine(env.BOT_ACTOR, botId, id),
        suspend: (botId, suspended) =>
          suspendBotRoutines(env.BOT_ACTOR, botId, suspended),
      },
      mcp: {
        add: (botId, input) => addBotMcp(env.BOT_ACTOR, botId, input),
        remove: (botId, serverId) =>
          removeBotMcp(env.BOT_ACTOR, botId, serverId),
        oauth: (botId, request) => oauthBotMcp(env.BOT_ACTOR, botId, request),
      },
      forgetBot: (botId) => destroyBotActor(env.BOT_ACTOR, botId),
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
                  eq(bots.id, botId),
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
