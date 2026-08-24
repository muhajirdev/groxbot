import type { AppStore, WakeupDriver } from "@groxbot/adapter-kit";
import {
  createSandboxProvider,
  createWakeupDriver,
} from "@groxbot/adapters/edge";
import { MemoryAppStore } from "@groxbot/app-runtime";
import { createAuth } from "@groxbot/auth";
import { groxbotCookieDomain } from "@groxbot/contracts";
import {
  AppError,
  GuestHub,
  getWorkspaceApp,
  handleGuestRequest,
} from "@groxbot/core";
import type { Database } from "@groxbot/db";
import { ORPCError } from "@orpc/server";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { RpcContext } from "./context.js";
import { mountDiscovery } from "./discovery.js";
import { type Env, oauthCredentials } from "./env.js";
import { healthPayload } from "./health.js";
import { createMailer } from "./mail.js";
import { completePluginCallback, pluginCallbackPage } from "./plugins.js";
import { mountRpc } from "./rpc.js";
import { requireActor } from "./session.js";

export interface AppHandles extends Omit<RpcContext, "headers"> {
  app: Hono;
  close: () => Promise<void>;
}

export function createApp(
  env: Env,
  opts: {
    db: Database;
    close: () => Promise<void>;
    wakeup?: WakeupDriver;
    appStore?: AppStore;
    connectApp?: (appId: string, request: Request) => Promise<Response>;
  },
): AppHandles {
  const oauth = oauthCredentials(env);
  const mail = createMailer(env);
  const auth = createAuth(opts.db, {
    secret: env.authSecret,
    baseURL: env.authUrl,
    trustedOrigins: env.corsOrigins,
    cookieDomain: groxbotCookieDomain(env.webOrigin),
    google: oauth.google,
    github: oauth.github,
    webOrigin: env.webOrigin,
    sendMagicLink: mail.sendMagicLink,
    sendInvitationEmail: mail.sendInvitation,
  });
  const wakeup = opts.wakeup ?? createWakeupDriver(env.workerUrl);
  const sandbox = createSandboxProvider(env.sandboxProvider);
  const guests = new GuestHub();
  const appStore = opts.appStore ?? new MemoryAppStore();

  const app = new Hono();
  app.use(
    "*",
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );

  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  const handles: AppHandles = {
    app,
    db: opts.db,
    auth,
    wakeup,
    sandbox,
    guests,
    appStore,
    env,
    close: async () => {
      guests.stop();
      await wakeup.stop();
      await opts.close();
    },
  };
  mountRpc(app, handles);
  mountDiscovery(app, env.webOrigin);

  if (opts.connectApp) {
    const connectApp = opts.connectApp;
    app.get("/apps/:appId/rpc", async (c) => {
      const origin = c.req.header("Origin");
      if (origin && !env.corsOrigins.includes(origin)) {
        return c.text("Forbidden", 403);
      }
      try {
        const actor = await requireActor({
          ...handles,
          headers: c.req.raw.headers,
        });
        await getWorkspaceApp(
          handles.db,
          actor.workspaceId,
          c.req.param("appId"),
        );
      } catch (error) {
        if (error instanceof AppError) {
          return c.text(error.message, 404);
        }
        if (error instanceof ORPCError) {
          return new Response(error.message, { status: error.status });
        }
        throw error;
      }
      return connectApp(c.req.param("appId"), c.req.raw);
    });
  }

  app.get("/api/plugins/callback", async (c) => {
    await completePluginCallback(handles, {
      id: c.req.query("id"),
      status: c.req.query("status") ?? undefined,
      connectedAccountId:
        c.req.query("connectedAccountId") ??
        c.req.query("connected_account_id") ??
        undefined,
    });
    return c.html(pluginCallbackPage(env.webOrigin));
  });

  if (!env.workerUrl && env.wakeupKind !== "durable-object") {
    app.all("/guest/*", async (c) => {
      const response = await handleGuestRequest(c.req.raw, {
        db: opts.db,
        hub: guests,
        wakeup,
      });
      if (!response) return c.notFound();
      return c.newResponse(response.body, response);
    });
  }

  app.get("/health", async (c) => {
    let database: "ok" | "error" = "ok";
    try {
      await opts.db.execute(sql`select 1`);
    } catch {
      database = "error";
    }
    return c.json({ ...healthPayload(env), database });
  });

  return handles;
}
