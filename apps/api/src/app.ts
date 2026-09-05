import type { EnqueueJob, InitApp, InitRoom } from "@groxbot/adapter-kit";
import { createAuth } from "@groxbot/auth";
import {
  groxbotCookieDomain,
  officeUserFromActor,
  withOfficeUserRequest,
} from "@groxbot/contracts";
import { GuestHub, handleGuestRequest, readAvatar } from "@groxbot/core";
import { bots, type Database, rooms } from "@groxbot/db";
import { ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { RpcContext } from "./context.js";
import { mountDiscovery } from "./discovery.js";
import { DURABLE_OBJECT_WAKEUP, type Env, oauthCredentials } from "./env.js";
import { healthPayload } from "./health.js";
import { createMailer, type SendEmailBinding } from "./mail.js";
import { completeMcpOAuth } from "./mcp.js";
import { completePluginCallback, pluginCallbackPage } from "./plugins.js";
import { mountPublicKnowledge } from "./public-knowledge.js";
import { mountRpc } from "./rpc.js";
import { requireActor } from "./session.js";
import { acceptInviteFromLink } from "./workspaces.js";
import { createBillingPort } from "./billing/index.js";
import { handlePolarWebhook } from "./billing/webhooks.js";
import { WebhookVerificationError } from "@polar-sh/sdk/webhooks";

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
    initRoom?: InitRoom;
    email?: SendEmailBinding;
    connectApp?: (
      appId: string,
      request: Request,
      workspaceId: string,
    ) => Promise<Response>;
    connectBot?: (
      botId: string,
      request: Request,
      workspaceId: string,
    ) => Promise<Response>;
    connectRoom?: (
      roomId: string,
      request: Request,
      workspaceId: string,
    ) => Promise<Response>;
    computer?: RpcContext["computer"];
    knowledge?: RpcContext["knowledge"];
    knowledgeDisk?: RpcContext["knowledgeDisk"];
    avatars?: RpcContext["avatars"];
    routines?: RpcContext["routines"];
    mcp?: RpcContext["mcp"];
    forgetBot?: RpcContext["forgetBot"];
    forgetApp?: RpcContext["forgetApp"];
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
    billing: createBillingPort(opts.db, env),
    enqueue: opts.enqueue,
    initApp: opts.initApp,
    initRoom: opts.initRoom,
    guests,
    env,
    computer: opts.computer,
    knowledge: opts.knowledge,
    knowledgeDisk: opts.knowledgeDisk,
    avatars: opts.avatars,
    routines: opts.routines,
    mcp: opts.mcp,
    forgetBot: opts.forgetBot,
    forgetApp: opts.forgetApp,
    close: async () => {
      guests.stop();
      await opts.close();
    },
  };
  mountRpc(app, handles);
  mountDiscovery(app, env.webOrigin);
  mountPublicKnowledge(app, { db: opts.db, disk: opts.knowledgeDisk });

  app.post("/internal/billing/ingest-usage", async (c) => {
    const auth = c.req.header("authorization");
    if (auth !== `Bearer ${env.authSecret}`) {
      return c.text("Forbidden", 403);
    }
    const body = (await c.req.json().catch(() => null)) as {
      usageId?: unknown;
      workspaceId?: unknown;
      userId?: unknown;
      model?: unknown;
      costCents?: unknown;
      promptTokens?: unknown;
      completionTokens?: unknown;
    };
    if (
      typeof body?.usageId !== "string" ||
      typeof body.workspaceId !== "string" ||
      typeof body.userId !== "string" ||
      typeof body.model !== "string" ||
      typeof body.costCents !== "number" ||
      typeof body.promptTokens !== "number" ||
      typeof body.completionTokens !== "number"
    ) {
      return c.text("Bad request", 400);
    }
    try {
      await handles.billing.ingestHostedUsage({
        usageId: body.usageId,
        workspaceId: body.workspaceId,
        userId: body.userId,
        model: body.model,
        costCents: body.costCents,
        promptTokens: body.promptTokens,
        completionTokens: body.completionTokens,
      });
      return c.body(null, 204);
    } catch (error) {
      console.error("billing ingest", error);
      return c.text("Ingest failed", 500);
    }
  });

  app.post("/polar/webhooks", async (c) => {
    if (!env.polarWebhookSecret?.trim()) {
      return c.text("Not found", 404);
    }
    try {
      const body = Buffer.from(await c.req.arrayBuffer());
      await handlePolarWebhook(handles.db, env, body, c.req.raw.headers);
      return c.body(null, 202);
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        return c.text("Forbidden", 403);
      }
      console.error("polar webhook", error);
      return c.text("Webhook handler failed", 500);
    }
  });

  app.get("/avatars/:userId", async (c) => {
    const disk = handles.avatars;
    if (!disk) return c.body(null, 404);
    try {
      const file = await readAvatar(disk, c.req.param("userId"));
      if (!file) return c.body(null, 404);
      return new Response(file.bytes, {
        status: 200,
        headers: {
          "content-type": file.mediaType,
          "cache-control": "public, max-age=86400",
        },
      });
    } catch {
      return c.body(null, 404);
    }
  });

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
        const status =
          typeof caught.status === "number" &&
          caught.status >= 400 &&
          caught.status < 600
            ? caught.status
            : 400;
        return c.json(
          { message: caught.message },
          status as ContentfulStatusCode,
        );
      }
      return c.json({ message: "Could not join workspace" }, 400);
    }
  });

  if (opts.connectBot) {
    const connectBot = opts.connectBot;
    app.get("/bots/:botId/rpc", async (c) => {
      const origin = c.req.header("Origin");
      if (origin && !env.corsOrigins.includes(origin)) {
        return c.text("Forbidden", 403);
      }
      try {
        const inbound = withQueryCookie(c.req.raw);
        const actor = await requireActor({
          ...handles,
          headers: inbound.headers,
        });
        const botId = c.req.param("botId");
        const [bot] = await opts.db
          .select({ id: bots.id })
          .from(bots)
          .where(
            and(eq(bots.id, botId), eq(bots.workspaceId, actor.workspaceId)),
          )
          .limit(1);
        if (!bot) return c.text("Not found", 404);
        const officeUser = officeUserFromActor(actor);
        const stamped = officeUser
          ? withOfficeUserRequest(inbound, officeUser)
          : inbound;
        return connectBot(botId, stamped, actor.workspaceId);
      } catch (error) {
        if (error instanceof ORPCError) {
          return new Response(error.message, { status: error.status });
        }
        throw error;
      }
    });
  }

  if (opts.connectRoom) {
    const connectRoom = opts.connectRoom;
    app.get("/rooms/:roomId/rpc", async (c) => {
      const origin = c.req.header("Origin");
      if (origin && !env.corsOrigins.includes(origin)) {
        return c.text("Forbidden", 403);
      }
      try {
        const inbound = withQueryCookie(c.req.raw);
        const actor = await requireActor({
          ...handles,
          headers: inbound.headers,
        });
        const roomId = c.req.param("roomId");
        const [room] = await opts.db
          .select({ id: rooms.id })
          .from(rooms)
          .where(
            and(eq(rooms.id, roomId), eq(rooms.workspaceId, actor.workspaceId)),
          )
          .limit(1);
        if (!room) return c.text("Not found", 404);
        const officeUser = officeUserFromActor(actor);
        const stamped = officeUser
          ? withOfficeUserRequest(inbound, officeUser)
          : inbound;
        return connectRoom(roomId, stamped, actor.workspaceId);
      } catch (error) {
        if (error instanceof ORPCError) {
          return new Response(error.message, { status: error.status });
        }
        throw error;
      }
    });
  }

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

  app.all("/api/mcp/oauth", async (c) => {
    return completeMcpOAuth(handles, c.req.raw);
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

/** React Native WebSocket cannot set Cookie; the office client puts it on the query. */
function withQueryCookie(request: Request): Request {
  if (request.headers.get("Cookie")) return request;
  const cookie = new URL(request.url).searchParams.get("Cookie")?.trim();
  if (!cookie) return request;
  const headers = new Headers(request.headers);
  headers.set("Cookie", cookie);
  return new Request(request, { headers });
}
