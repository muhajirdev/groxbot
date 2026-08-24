/** Product API: Cloudflare Worker + Neon HTTP + Durable Object BotActor. */
import { DurableObject } from "cloudflare:workers";
import {
  bindAgentRuntime,
  createHostedAgentRuntime,
  createPluginTools,
  type WorkersAiBinding,
} from "@groxbot/adapters/edge";
import { DEFAULT_AI_GATEWAY_ID } from "@groxbot/contracts";
import { createWakeHandlers } from "@groxbot/core";
import { createNeonHttpDb } from "@groxbot/db/neon";
import { createApp } from "./app.js";
import { AppRuntime, DurableObjectAppStore } from "./app-runtime-do.js";
import { enqueueOnBot } from "./bot-enqueue.js";
import {
  agentRuntimeSource,
  DURABLE_OBJECT_WAKEUP,
  type Env,
  loadEnv,
} from "./env.js";
import type { SendEmailBinding } from "./mail.js";

export { AppRuntime };

export interface WorkerEnv {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  ENCRYPTION_KEY?: string;
  BETTER_AUTH_URL: string;
  API_URL: string;
  WEB_ORIGIN: string;
  CORS_ORIGINS?: string;
  SANDBOX_PROVIDER?: string;
  NODE_ENV?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_AI_GATEWAY_TOKEN?: string;
  CLOUDFLARE_AI_GATEWAY_ID?: string;
  EMAIL_FROM?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  COMPOSIO_API_KEY?: string;
  EMAIL?: SendEmailBinding;
  AI?: WorkersAiBinding;
  BOT_ACTOR: DurableObjectNamespace;
  APP_RUNTIME: DurableObjectNamespace;
  LOADER: unknown;
}

function productEnv(env: WorkerEnv): Env {
  const loaded = loadEnv(env as unknown as NodeJS.ProcessEnv);
  loaded.emailBinding = Boolean(env.EMAIL);
  loaded.hostedAiBinding = Boolean(env.AI);
  loaded.wakeupKind = DURABLE_OBJECT_WAKEUP;
  return loaded;
}

type StoredJob = {
  botId: string;
  name: string;
  payload: Record<string, unknown>;
  runAt?: number;
  jobKey?: string;
};

export class BotActor extends DurableObject<WorkerEnv> {
  private handlers?: Record<
    string,
    (payload: Record<string, unknown>) => Promise<void>
  >;
  private tail = Promise.resolve();

  private async boot(): Promise<void> {
    if (this.handlers) return;
    const env = productEnv(this.env);
    const { db } = createNeonHttpDb(env.databaseUrl);
    const source = agentRuntimeSource(env);
    const runtime = createHostedAgentRuntime(source, {
      ai: this.env.AI,
      gatewayId: env.cloudflareAiGatewayId || DEFAULT_AI_GATEWAY_ID,
    });
    const apps = new DurableObjectAppStore(this.env.APP_RUNTIME);
    this.handlers = createWakeHandlers({
      db,
      runtime,
      env: source,
      enqueue: (job) => enqueueOnBot(this.env.BOT_ACTOR, job),
      initApp: (appId, templateId, opts) => apps.init(appId, templateId, opts),
      bindRuntime: (overlay) => bindAgentRuntime(overlay, { ai: this.env.AI }),
      pluginTools: (input) =>
        createPluginTools({
          ...input,
          env: { COMPOSIO_API_KEY: env.composioApiKey },
        }),
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.boot();
    const body = (await request.json()) as StoredJob & { runAt?: string };
    const runAt = body.runAt
      ? typeof body.runAt === "number"
        ? body.runAt
        : Date.parse(body.runAt)
      : 0;
    const job: StoredJob = {
      botId: body.botId,
      name: body.name,
      payload: body.payload ?? {},
      runAt: Number.isFinite(runAt) ? runAt : 0,
      jobKey: body.jobKey,
    };
    if (job.runAt && job.runAt > Date.now()) {
      if (job.jobKey) {
        const existing = await this.ctx.storage.list({ prefix: "job:" });
        for (const [key, value] of existing) {
          if ((value as StoredJob).jobKey === job.jobKey) {
            await this.ctx.storage.delete(key);
          }
        }
      }
      await this.ctx.storage.put(
        `job:${job.jobKey ?? crypto.randomUUID()}`,
        job,
      );
      await this.scheduleAlarm();
      return new Response("scheduled", { status: 202 });
    }
    this.ctx.waitUntil(this.push(job));
    return new Response("queued", { status: 202 });
  }

  async alarm(): Promise<void> {
    await this.boot();
    const now = Date.now();
    const list = await this.ctx.storage.list({ prefix: "job:" });
    let next: number | undefined;
    for (const [key, value] of list) {
      const job = value as StoredJob;
      const at = job.runAt ?? 0;
      if (at <= now) {
        await this.ctx.storage.delete(key);
        await this.push(job);
      } else if (next === undefined || at < next) {
        next = at;
      }
    }
    if (next !== undefined) await this.ctx.storage.setAlarm(next);
  }

  private async scheduleAlarm(): Promise<void> {
    const list = await this.ctx.storage.list({ prefix: "job:" });
    let next: number | undefined;
    for (const value of list.values()) {
      const at = (value as StoredJob).runAt ?? 0;
      if (!next || at < next) next = at;
    }
    if (next !== undefined) await this.ctx.storage.setAlarm(next);
  }

  private push(job: StoredJob): Promise<void> {
    const run = async () => {
      const handler = this.handlers?.[job.name];
      if (!handler) return;
      await handler({ ...job.payload, botId: job.botId });
    };
    this.tail = this.tail.then(run).catch((error) => {
      console.error("bot actor", job.botId, job.name, error);
    });
    return this.tail;
  }
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
      email: env.EMAIL,
    });
    return handles.app.fetch(request);
  },
};
