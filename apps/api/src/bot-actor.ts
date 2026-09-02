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
import { createKnowledgeTools } from "./bot-knowledge.js";
import { WorkspaceMcpConnector } from "./bot-mcp-connector.js";
import { bindToMarkdown, createPageTools } from "./bot-markdown.js";
import type { WorkersAiBinding } from "@groxbot/adapters/edge";
import {
  gatewayChatUrl,
  gatewayConfigured,
  gatewayRequestModel,
  loadGatewayConfig,
} from "@groxbot/adapters/edge";
import {
  HOSTED_STARTER_MODEL,
  labelForModel,
  officeUserFromHeaders,
  parseOfficeUser,
  stampIncomingOfficeUser,
} from "@groxbot/contracts";
import { getCurrentAgent } from "agents";
import { AgentContextProvider } from "agents/experimental/memory/session";
import {
  encryptionSecret,
  listComputerEntries,
  readComputerFile,
  downloadComputerFile,
  decodeComputerBytes,
  writeInboxFile,
  hostedChatMessages,
  resolveRunModel,
  rewriteThinkCapability,
  composeSoul,
  soulOverlayFromWrite,
  teammatePrompt,
  workspaceSkillSource,
  officeSkillSource,
  ComputerFileError,
  ComputerPathError,
  ComputerWriteError,
  saveMcpConnection,
} from "@groxbot/core";
import { bots } from "@groxbot/db";
import { createNeonHttpDb } from "@groxbot/db/neon";
import { eq } from "drizzle-orm";
import {
  agentRuntimeSource,
  productEnv,
  type RuntimeSource,
} from "./env.js";
import { mcpCallbackPage } from "./mcp-callback-page.js";
import type { SendEmailBinding } from "./mail.js";
import { r2KnowledgeDisk } from "./knowledge-r2.js";

function connectedOfficeUser() {
  const { connection, request } = getCurrentAgent();
  return (
    parseOfficeUser(connection?.state) ??
    officeUserFromHeaders(request?.headers ?? new Headers())
  );
}

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
  KNOWLEDGE?: R2Bucket;
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
  /** MCP is tools.* / named connectors inside execute, not a dumped AI SDK catalog. */
  override includeMcpTools = false;
  override waitForMcpConnections = true;
  private soulPrompt = "You are a helpful teammate.";
  private turnModel = HOSTED_STARTER_MODEL;
  private turnHosted = true;
  private turnEnv: RuntimeSource = {};
  /** Memory writes wait in SQLite until we refresh the frozen prompt. */
  private memoryDirty = false;
  private botLoaded = false;
  private botLoading: Promise<void> | null = null;
  private officeId = "";

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

  /** Strip file parts before `convertToModelMessages` calls `new URL(part.url)`. */
  async _repairTranscriptForProvider(messages) {
    return super._repairTranscriptForProvider(hostedChatMessages(messages));
  }

  beforeStep(ctx: Parameters<Think["beforeStep"]>[0]) {
    const messages = hostedChatMessages(ctx.messages);
    if (messages === ctx.messages) return;
    return { messages };
  }

  afterToolCall(ctx: ToolCallResultContext) {
    if (ctx.success && ctx.toolName === "set_context") this.memoryDirty = true;
  }

  async onChatResponse(): Promise<void> {
    await this.flushMemory();
  }

  async onStart(): Promise<void> {
    this.ensureMcpOAuthCallback();
    console.log(`[bot ${this.name}] onStart after think hydrate`);
  }

  async onConnect(connection, ctx) {
    const user =
      officeUserFromHeaders(ctx.request.headers) ??
      parseOfficeUser(connection.state);
    if (user) connection.setState(user);
    return super.onConnect(connection, ctx);
  }

  /**
   * Chat-request persist. Stamp only new user rows — `_rowSafe` also runs on
   * history upserts and would otherwise rewrite other humans as the sender.
   */
  async _persistIncomingMessage(msg, serverMessages) {
    const existing =
      msg && typeof msg === "object" && "id" in msg
        ? serverMessages.find((row) => row.id === msg.id)
        : undefined;
    return super._persistIncomingMessage(
      stampIncomingOfficeUser(msg, connectedOfficeUser(), existing),
      serverMessages,
    );
  }

  configureSession(session: Parameters<Think["configureSession"]>[0]) {
    console.log(`[bot ${this.name}] configureSession`);
    const evolved = new AgentContextProvider(this, "soul-evolved");
    const actor = this;
    return session
      .withContext("soul", {
        description:
          "Who you are and how you sound. Starts as your name plus how this office works. Grow it with set_context as you learn this desk. Keep it dense. Keep your name. Facts about people and work go in memory.",
        maxTokens: 2000,
        provider: {
          get: async () => {
            // Do not block Think hydrate / get-messages on Neon. Chat turns
            // still wait in beforeTurn; loadBot refreshes the prompt after.
            void actor.ensureBotLoaded();
            return composeSoul(actor.soulPrompt, (await evolved.get()) ?? "");
          },
          set: async (content: string) => {
            await evolved.set(
              soulOverlayFromWrite(actor.soulPrompt, content),
            );
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
    const knowledge = this.officeKnowledge();
    return {
      ...pageTools,
      ...(knowledge
        ? createKnowledgeTools({
            disk: knowledge,
            workspaceId: this.officeId,
          })
        : {}),
      execute: createExecuteTool(this, {
        executor: createBundlingExecutor(this.env.LOADER, { timeout: 120_000 }),
        session: { mode: "reuse", key: this.name },
        tools: pageTools,
        connectors: this.mcpExecuteConnectors(),
      }),
    };
  }

  getSkills() {
    // Office skills first. Computer skills stay as private drafts.
    const office = this.officeKnowledge();
    const sources = office
      ? [officeSkillSource(office, this.officeId)]
      : [];
    sources.push(workspaceSkillSource(this.workspace));
    return sources;
  }

  getSkillScriptRunner() {
    return skills.runner({
      loader: this.env.LOADER,
      workspaceInstance: this.workspace,
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/wakeup") {
      return this.handleWakeup(request);
    }
    if (request.method === "POST" && url.pathname === "/workspace/list") {
      return this.handleWorkspaceList(request);
    }
    if (request.method === "POST" && url.pathname === "/workspace/read") {
      return this.handleWorkspaceRead(request);
    }
    if (request.method === "POST" && url.pathname === "/workspace/download") {
      return this.handleWorkspaceDownload(request);
    }
    if (request.method === "POST" && url.pathname === "/workspace/write") {
      return this.handleWorkspaceWrite(request);
    }
    if (request.method === "POST" && url.pathname === "/mcp/add") {
      return this.handleMcpAdd(request);
    }
    if (request.method === "POST" && url.pathname === "/mcp/remove") {
      return this.handleMcpRemove(request);
    }
    if (request.method === "POST" && url.pathname === "/destroy") {
      return this.handleDestroy();
    }
    return super.fetch(request);
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
    this.officeId = bot.workspaceId;
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

  private async handleWorkspaceDownload(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as { path?: unknown };
    const path = typeof body.path === "string" ? body.path : "";
    try {
      return Response.json(await downloadComputerFile(this.workspace, path));
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

  private async handleDestroy(): Promise<Response> {
    try {
      this.cancelAllChats();
    } catch (error) {
      console.error("bot actor cancel", this.name, error);
    }
    try {
      await this.ctx.storage.deleteAlarm();
    } catch {
      // No alarm scheduled.
    }
    await this.ctx.storage.deleteAll();
    return Response.json({ ok: true });
  }

  private ensureMcpOAuthCallback(): void {
    this.mcp.configureOAuthCallback({
      customHandler: async (result) => {
        await this.markMcpOAuth(result);
        return new Response(mcpCallbackPage(this.env.WEB_ORIGIN), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    });
  }

  private officeKnowledge() {
    if (!this.env.KNOWLEDGE || !this.officeId) return null;
    return r2KnowledgeDisk(this.env.KNOWLEDGE);
  }

  private mcpExecuteConnectors(): WorkspaceMcpConnector[] {
    const used = new Set<string>();
    const connectors: WorkspaceMcpConnector[] = [];
    const servers = this.getMcpServers().servers;
    for (const [id, server] of Object.entries(servers)) {
      if (server.state !== "ready") continue;
      const connection = this.mcp.mcpConnections[id];
      if (!connection) continue;
      let name = server.name.trim() || "mcp";
      if (used.has(name)) name = `${name}-${id.slice(0, 8)}`;
      used.add(name);
      connectors.push(
        new WorkspaceMcpConnector(this.ctx, this.env, connection, name),
      );
    }
    return connectors;
  }

  private async handleMcpAdd(request: Request): Promise<Response> {
    this.ensureMcpOAuthCallback();
    const body = (await request.json().catch(() => ({}))) as {
      serverId?: unknown;
      name?: unknown;
      url?: unknown;
      callbackHost?: unknown;
    };
    const serverId = typeof body.serverId === "string" ? body.serverId : "";
    const name = typeof body.name === "string" ? body.name : "";
    const url = typeof body.url === "string" ? body.url : "";
    const callbackHost =
      typeof body.callbackHost === "string" ? body.callbackHost : "";
    if (!serverId || !name || !url || !callbackHost) {
      return Response.json({ error: "MCP server is missing fields." }, { status: 400 });
    }
    try {
      const result = await this.addMcpServer(name, url, {
        id: serverId,
        callbackHost,
        callbackPath: "api/mcp/oauth",
      });
      return Response.json(result);
    } catch (error) {
      console.error("bot actor mcp add", this.name, error);
      return Response.json(
        {
          error:
            error instanceof Error ? error.message : "Could not connect MCP.",
        },
        { status: 400 },
      );
    }
  }

  private async handleMcpRemove(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as {
      serverId?: unknown;
    };
    const serverId = typeof body.serverId === "string" ? body.serverId : "";
    if (!serverId) {
      return Response.json({ error: "MCP server missing." }, { status: 400 });
    }
    try {
      await this.removeMcpServer(serverId);
      return Response.json({ ok: true });
    } catch (error) {
      console.error("bot actor mcp remove", this.name, error);
      return Response.json(
        {
          error:
            error instanceof Error ? error.message : "Could not remove MCP.",
        },
        { status: 400 },
      );
    }
  }

  private async markMcpOAuth(result: {
    serverId?: string;
    authSuccess: boolean;
    authError?: string;
  }): Promise<void> {
    if (!result.serverId) return;
    try {
      const env = productEnv(this.env);
      const { db } = createNeonHttpDb(env.databaseUrl);
      await saveMcpConnection(db, result.serverId, {
        status: result.authSuccess ? "connected" : "error",
        lastError: result.authSuccess
          ? null
          : result.authError || "Authentication failed",
      });
    } catch (error) {
      console.error("bot actor mcp oauth", this.name, error);
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

silenceThinkSystemPromptFallbackWarning();

/**
 * Think warns when getSkills() is set and getSystemPrompt looks replaced.
 * BotActor never overrides it — always-on instructions are the soul/memory
 * context blocks. Workerd binds Durable Object methods, so Think's identity
 * check false-positives; drop that one warning around skill init.
 */
function silenceThinkSystemPromptFallbackWarning() {
  const proto = Think.prototype as unknown as {
    _initializeSkills: (this: Think) => Promise<void>;
  };
  const original = proto._initializeSkills;
  const nativeWarn = console.warn;
  let depth = 0;
  proto._initializeSkills = async function (this: Think) {
    depth += 1;
    if (depth === 1) {
      console.warn = (...args: unknown[]) => {
        if (
          typeof args[0] === "string" &&
          args[0].includes("getSystemPrompt() is only used as a fallback")
        ) {
          return;
        }
        nativeWarn.apply(console, args);
      };
    }
    try {
      return await original.call(this);
    } finally {
      depth -= 1;
      if (depth === 0) console.warn = nativeWarn;
    }
  };
}
