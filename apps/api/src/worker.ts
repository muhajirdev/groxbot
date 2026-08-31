/** Product API: Cloudflare Worker + Neon HTTP + Durable Object BotActor (Think). */
import { bots } from "@groxbot/db";
import { createNeonHttpDb } from "@groxbot/db/neon";
import { ORPCError } from "@orpc/server";
import { routeAgentRequest } from "agents";
import { and, eq } from "drizzle-orm";
import { createApp } from "./app.js";
import { AppRuntime, DurableObjectAppStore } from "./app-runtime-do.js";
import { BotActor, type WorkerEnv } from "./bot-actor.js";
import { enqueueOnBot } from "./bot-enqueue.js";
import { productEnv } from "./env.js";
import { requireActor } from "./session.js";

export { AppRuntime, BotActor };

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

function agentLog(id: string, t0: number, pathname: string, step: string) {
  console.log(`[agents ${id}] +${Date.now() - t0}ms ${pathname} ${step}`);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const loaded = productEnv(env);
    const t0 = Date.now();
    const { db, close } = createNeonHttpDb(loaded.databaseUrl);
    const apps = new DurableObjectAppStore(env.APP_RUNTIME);
    const handles = createApp(loaded, {
      db,
      close,
      enqueue: (job) => enqueueOnBot(env.BOT_ACTOR, job),
      initApp: (appId, templateId, opts) => apps.init(appId, templateId, opts),
      connectApp: (appId, request, workspaceId) =>
        apps.connect(appId, request, workspaceId),
      email: env.EMAIL,
    });

    const url = new URL(request.url);
    if (url.pathname.startsWith("/agents/")) {
      const id = crypto.randomUUID().slice(0, 8);
      const pathname = url.pathname;
      agentLog(id, t0, pathname, `start ${request.method}`);
      if (request.method !== "OPTIONS") {
        try {
          const actor = await requireActor({
            ...handles,
            headers: request.headers,
          });
          agentLog(id, t0, pathname, `auth ${actor.workspaceId}`);
          const botId = agentInstanceName(pathname);
          const messagesOnly = pathname.endsWith("/get-messages");
          if (botId && !messagesOnly) {
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
            agentLog(id, t0, pathname, bot ? "membership ok" : "membership miss");
            if (!bot) return new Response("Not found", { status: 404 });
          }
        } catch (error) {
          agentLog(id, t0, pathname, "auth fail");
          if (error instanceof ORPCError) {
            return new Response(error.message, { status: error.status });
          }
          throw error;
        }
      }
      agentLog(id, t0, pathname, "do begin");
      const response =
        (await routeAgentRequest(request, env, {
          cors: agentCors(request, loaded.corsOrigins),
        })) || new Response("Not found", { status: 404 });
      agentLog(id, t0, pathname, `do done ${response.status}`);
      return response;
    }

    return handles.app.fetch(request);
  },
};
