/** Cloudflare-only. Excluded from `tsc`. BotActor is Think. */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  Think,
  skills,
  type MessageConcurrency,
  type ToolCallResultContext,
  type TurnContext,
} from "@cloudflare/think";
import { createExecuteTool } from "@cloudflare/think/tools/execute";
import type { ToolSet } from "ai";
import { createBundlingExecutor } from "./bot-execute.js";
import { bindToMarkdown, createPageTools } from "./bot-markdown.js";
import type { WorkersAiBinding } from "@groxbot/adapters/edge";
import {
  gatewayChatUrl,
  gatewayConfigured,
  gatewayRequestModel,
  loadGatewayConfig,
} from "@groxbot/adapters/edge";
import { HOSTED_STARTER_MODEL, labelForModel } from "@groxbot/contracts";
import {
  encryptionSecret,
  listComputerEntries,
  readComputerFile,
  decodeComputerBytes,
  writeInboxFile,
  resolveRunModel,
  rewriteThinkCapability,
  teammatePrompt,
  workspaceSkillSource,
  ComputerFileError,
  ComputerPathError,
  ComputerWriteError,
} from "@groxbot/core";
import { bots } from "@groxbot/db";
import { createNeonHttpDb } from "@groxbot/db/neon";
import { eq } from "drizzle-orm";
import {
  agentRuntimeSource,
  productEnv,
  type RuntimeSource,
} from "./env.js";
import type { SendEmailBinding } from "./mail.js";

export interface WorkerEnv {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  ENCRYPTION_KEY?: string;
  BETTER_AUTH_URL: string;
  API_URL: string;
  WEB_ORIGIN: string;
  CORS_ORIGINS?: string;
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
  BROWSER: unknown;
}

type StoredJob = {
  botId: string;
  name: string;
  payload: Record<string, unknown>;
  runAt?: number;
  jobKey?: string;
};

function workspaceError(error: unknown): Response {
  if (error instanceof ComputerPathError || error instanceof ComputerWriteError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ComputerFileError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  console.error("bot actor workspace", error);
  return Response.json({ error: "Could not read this computer." }, { status: 500 });
}

export class BotActor extends Think<WorkerEnv> {
  override messageConcurrency: MessageConcurrency = "queue";
  /** MCP is tools.* inside execute, not a dumped AI SDK catalog. */
  override includeMcpTools = false;
  private soulPrompt = "You are a helpful teammate.";
  private turnModel = HOSTED_STARTER_MODEL;
  private turnHosted = true;
  private turnEnv: RuntimeSource = {};
  /** Memory writes wait in SQLite until we refresh the frozen prompt. */
  private memoryDirty = false;
  private botLoaded = false;
  private botLoading: Promise<void> | null = null;

  getModel() {
    const id = gatewayRequestModel(this.turnModel);
    if (this.turnHosted || id.startsWith("@cf/")) return id;
    if (!gatewayConfigured(this.turnEnv)) return id;
    const config = loadGatewayConfig(this.turnEnv);
    const chatUrl = gatewayChatUrl(config);
    const baseURL = chatUrl.replace(/\/chat\/completions$/, "");
    const provider = createOpenAICompatible({
      name: config.provider,
      apiKey: config.apiKey,
      baseURL,
    });
    return provider.chatModel(id);
  }

  async beforeTurn(ctx: TurnContext) {
    await this.ensureBotLoaded();
    return { system: rewriteThinkCapability(ctx.system) };
  }

  afterToolCall(ctx: ToolCallResultContext) {
    if (ctx.success && ctx.toolName === "set_context") this.memoryDirty = true;
  }

  async onChatResponse(): Promise<void> {
    await this.flushMemory();
  }

  async onStart(): Promise<void> {
    console.log(`[bot ${this.name}] onStart after think hydrate`);
  }

  configureSession(session: Parameters<Think["configureSession"]>[0]) {
    console.log(`[bot ${this.name}] configureSession`);
    return session
      .withContext("soul", {
        provider: {
          get: async () => {
            // Do not block Think hydrate / get-messages on Neon. Chat turns
            // still wait in beforeTurn; loadBot refreshes the prompt after.
            void this.ensureBotLoaded();
            return this.soulPrompt;
          },
        },
      })
      .withContext("memory", {
        description:
          "Short facts about this office, people, and work. Update with set_context. Keep it dense.",
        maxTokens: 2000,
      })
      .withCachedPrompt();
  }

  getTools(): ToolSet {
    const pageTools = createPageTools({
      workspace: this.workspace,
      convert: bindToMarkdown(this.env.AI),
    });
    return {
      ...pageTools,
      execute: createExecuteTool(this, {
        executor: createBundlingExecutor(this.env.LOADER, { timeout: 120_000 }),
        session: { mode: "reuse", key: this.name },
        tools: pageTools,
      }),
    };
  }

  getSkills() {
    return [workspaceSkillSource(this.workspace)];
  }

  getSkillScriptRunner() {
    return skills.runner({
      loader: this.env.LOADER,
      workspaceInstance: this.workspace,
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const t0 = Date.now();
    const tail = url.pathname.split("/").pop() ?? url.pathname;
    console.log(`[bot ${this.name}] fetch in ${request.method} ${tail}`);
    if (request.method === "POST" && url.pathname === "/wakeup") {
      return this.handleWakeup(request);
    }
    if (request.method === "POST" && url.pathname === "/workspace/list") {
      return this.handleWorkspaceList(request);
    }
    if (request.method === "POST" && url.pathname === "/workspace/read") {
      return this.handleWorkspaceRead(request);
    }
    if (request.method === "POST" && url.pathname === "/workspace/write") {
      return this.handleWorkspaceWrite(request);
    }
    const response = await super.fetch(request);
    console.log(
      `[bot ${this.name}] fetch out ${tail} +${Date.now() - t0}ms ${response.status}`,
    );
    return response;
  }

  async onScheduledWake(job: StoredJob): Promise<void> {
    await this.dispatch(job);
  }

  private async flushMemory(): Promise<void> {
    if (!this.memoryDirty) return;
    this.memoryDirty = false;
    try {
      await this.session.refreshSystemPrompt();
    } catch (error) {
      this.memoryDirty = true;
      console.error("bot actor memory", this.name, error);
    }
  }

  private async ensureBotLoaded(): Promise<void> {
    if (this.botLoaded) return;
    if (!this.botLoading) {
      const t0 = Date.now();
      console.log(`[bot ${this.name}] loadBot begin`);
      this.botLoading = this.loadBot()
        .then(async () => {
          this.botLoaded = true;
          try {
            await this.session.refreshSystemPrompt();
          } catch (error) {
            console.error("bot actor soul", this.name, error);
          }
          console.log(`[bot ${this.name}] loadBot done +${Date.now() - t0}ms`);
        })
        .catch((error) => {
          console.error("bot actor start", this.name, error);
        })
        .finally(() => {
          this.botLoading = null;
        });
    }
    await this.botLoading;
  }

  private async loadBot(): Promise<void> {
    const env = productEnv(this.env);
    const source = agentRuntimeSource(env);
    const { db } = createNeonHttpDb(env.databaseUrl);
    const [bot] = await db
      .select()
      .from(bots)
      .where(eq(bots.id, this.name))
      .limit(1);
    if (!bot) return;
    const overlay = await resolveRunModel(
      db,
      bot,
      source,
      encryptionSecret(source, env.production),
    );
    this.turnModel = overlay.model || HOSTED_STARTER_MODEL;
    this.turnHosted = overlay.hosted;
    this.turnEnv = overlay.env;
    this.soulPrompt = teammatePrompt({
      ...bot,
      modelLabel: labelForModel(this.turnModel),
    });
  }

  private async handleWorkspaceList(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as { path?: unknown };
    const path = typeof body.path === "string" ? body.path : "";
    const t0 = Date.now();
    try {
      const listed = await listComputerEntries(this.workspace, path);
      console.log(
        `[bot ${this.name}] workspace list ${listed.entries.length} +${Date.now() - t0}ms`,
      );
      return Response.json(listed);
    } catch (error) {
      console.error(`[bot ${this.name}] workspace list +${Date.now() - t0}ms`, error);
      return workspaceError(error);
    }
  }

  private async handleWorkspaceRead(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as { path?: unknown };
    const path = typeof body.path === "string" ? body.path : "";
    try {
      return Response.json(await readComputerFile(this.workspace, path));
    } catch (error) {
      return workspaceError(error);
    }
  }

  private async handleWorkspaceWrite(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as {
      filename?: unknown;
      content?: unknown;
    };
    const filename = typeof body.filename === "string" ? body.filename : "";
    const content = typeof body.content === "string" ? body.content : "";
    try {
      const bytes = decodeComputerBytes(content);
      return Response.json(await writeInboxFile(this.workspace, filename, bytes));
    } catch (error) {
      return workspaceError(error);
    }
  }

  private async handleWakeup(request: Request): Promise<Response> {
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
      await this.schedule(new Date(job.runAt), "onScheduledWake", job);
      return new Response("scheduled", { status: 202 });
    }
    this.ctx.waitUntil(this.dispatch(job));
    return new Response("queued", { status: 202 });
  }

  private async dispatch(job: StoredJob): Promise<void> {
    try {
      if (job.name === "run.abort") {
        this.cancelAllChats();
      }
    } catch (error) {
      console.error("bot actor", job.botId, job.name, error);
    }
  }
}
