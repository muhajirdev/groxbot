/** Product API: Cloudflare Worker + Neon HTTP + Durable Object BotActor. */
import { DurableObject } from "cloudflare:workers";
import {
  bindAgentRuntime,
  createHostedAgentRuntime,
  createPluginTools,
} from "@groxbot/adapters/edge";
import { createWakeHandlers } from "@groxbot/core";
import { createNeonHttpDb } from "@groxbot/db/neon";
import { createApp } from "./app.js";
import { AppRuntime, DurableObjectAppStore } from "./app-runtime-do.js";
import { enqueueOnBot } from "./bot-enqueue.js";
import { agentRuntimeSource, loadEnv } from "./env.js";

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
  AGENT_RUNTIME?: string;
  WAKEUP_KIND?: string;
  NODE_ENV?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_EMAIL_API_TOKEN?: string;
  EMAIL_FROM?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  COMPOSIO_API_KEY?: string;
  BOT_ACTOR: DurableObjectNamespace;
  APP_RUNTIME: DurableObjectNamespace;
  LOADER: unknown;
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
    const env = loadEnv(this.env as unknown as NodeJS.ProcessEnv);
    const { db } = createNeonHttpDb(env.databaseUrl);
    const runtime = createHostedAgentRuntime(agentRuntimeSource(env));
    const apps = new DurableObjectAppStore(this.env.APP_RUNTIME);
    this.handlers = createWakeHandlers({
      db,
      runtime,
      enqueue: (job) => enqueueOnBot(this.env.BOT_ACTOR, job),
      initApp: (appId, templateId, opts) => apps.init(appId, templateId, opts),
      bindRuntime: (overlay) => bindAgentRuntime(env.agentRuntime, overlay),
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
    const loaded = loadEnv(env as unknown as NodeJS.ProcessEnv);
    const { db, close } = createNeonHttpDb(loaded.databaseUrl);
    const apps = new DurableObjectAppStore(env.APP_RUNTIME);
    const handles = createApp(loaded, {
      db,
      close,
      enqueue: (job) => enqueueOnBot(env.BOT_ACTOR, job),
      initApp: (appId, templateId, opts) => apps.init(appId, templateId, opts),
      connectApp: (appId, request, workspaceId) =>
        apps.connect(appId, request, workspaceId),
    });
    return handles.app.fetch(request);
  },
};
