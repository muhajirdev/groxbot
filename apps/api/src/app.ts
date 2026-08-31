import type { EnqueueJob, InitApp } from "@groxbot/adapter-kit";
import { createAuth } from "@groxbot/auth";
import { groxbotCookieDomain } from "@groxbot/contracts";
import { GuestHub, handleGuestRequest } from "@groxbot/core";
import type { Database } from "@groxbot/db";
import { ORPCError } from "@orpc/server";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { RpcContext } from "./context.js";
import { mountDiscovery } from "./discovery.js";
import { DURABLE_OBJECT_WAKEUP, type Env, oauthCredentials } from "./env.js";
import { healthPayload } from "./health.js";
import { createMailer, type SendEmailBinding } from "./mail.js";
import { completePluginCallback, pluginCallbackPage } from "./plugins.js";
import { mountRpc } from "./rpc.js";
import { requireActor } from "./session.js";
import { acceptInviteFromLink } from "./workspaces.js";

export interface AppHandles extends Omit<RpcContext, "headers"> {
  app: Hono;
  close: () => Promise<void>;
}

export function createApp(
  env: Env,
  opts: {
    db: Database;
    close: () => Promise<void>;
    enqueue: EnqueueJob;
    initApp: InitApp;
    email?: SendEmailBinding;
    connectApp?: (
      appId: string,
      request: Request,
      workspaceId: string,
    ) => Promise<Response>;
  },
): AppHandles {
  const oauth = oauthCredentials(env);
  const mail = createMailer({ ...env, email: opts.email });
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
  const guests = new GuestHub();

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
    enqueue: opts.enqueue,
    initApp: opts.initApp,
    guests,
    env,
    close: async () => {
      guests.stop();
      await opts.close();
    },
  };
  mountRpc(app, handles);
  mountDiscovery(app, env.webOrigin);

  app.post("/api/invites/accept", async (c) => {
    let invitationId = "";
    try {
      const body = (await c.req.json()) as { invitationId?: unknown };
      invitationId =
        typeof body.invitationId === "string" ? body.invitationId : "";
    } catch {
      return c.json({ message: "Paste an invite to join." }, 400);
    }
    try {
      const accepted = await acceptInviteFromLink(
        { ...handles, headers: c.req.raw.headers },
        c.req.raw,
        invitationId,
      );
      const response = c.json(accepted.workspace);
      for (const cookie of accepted.cookies) {
        response.headers.append("Set-Cookie", cookie);
      }
      return response;
    } catch (caught) {
      if (caught instanceof ORPCError) {
        return c.json({ message: caught.message }, caught.status);
      }
      return c.json({ message: "Could not join workspace" }, 400);
    }
  });

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
        return connectApp(c.req.param("appId"), c.req.raw, actor.workspaceId);
      } catch (error) {
        if (error instanceof ORPCError) {
          return new Response(error.message, { status: error.status });
        }
        throw error;
      }
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

  if (!env.workerUrl && env.wakeupKind !== DURABLE_OBJECT_WAKEUP) {
    app.all("/guest/*", async (c) => {
      const response = await handleGuestRequest(c.req.raw, {
        db: opts.db,
        hub: guests,
        enqueue: opts.enqueue,
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
