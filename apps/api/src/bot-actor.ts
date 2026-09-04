/** Cloudflare-only. Excluded from `tsc`. Disk is Computer; Think still owns office chat. */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAITools } from "@cloudflare/computer/tools";
import {
  type ChatResponseResult,
  type MessageConcurrency,
  skills,
  Think,
  type ToolCallResultContext,
  type TurnContext,
} from "@cloudflare/think";
import { createExecuteTool } from "@cloudflare/think/tools/execute";
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
  type Routine,
  stampIncomingOfficeUser,
} from "@groxbot/contracts";
import {
  applyOfficeReviewTurn,
  assistantTurnSettled,
  ComputerFileError,
  ComputerPathError,
  ComputerWriteError,
  COMPUTER_DISK_DOFS,
  COMPUTER_DISK_FLAG,
  computerWorkerShell,
  composeSoul,
  copyThinkWorkspaceToComputer,
  countUiToolParts,
  DEFAULT_ROUTINE_TIMEZONE,
  decodeComputerBytes,
  diskFromComputerFs,
  downloadComputerFile,
  emptyOfficeReviewCounters,
  encryptionSecret,
  formatRoutinePrompt,
  healThinkWorkspaceFileRows,
  hostedChatMessages,
  isoUnixSeconds,
  listComputerEntries,
  MCP_OAUTH_SETTLE_MS,
  mcpCatalogStatusFromThink,
  mcpConnectionIsExecutable,
  mcpServersForExecute,
  newId,
  OFFICE_REVIEW_STORAGE,
  officeReviewDue,
  officeReviewUserMessage,
  officeSkillSlashTurn,
  officeThinkSkillSources,
  parseOfficeReviewCounters,
  patchComputerWorkspace,
  prepareRoutineCreate,
  RoutineError,
  RoutineNotFoundError,
  RoutineScheduleError,
  readComputerFile,
  resolveRunModel,
  rewriteThinkCapability,
  type StoredRoutine,
  saveMcpConnection,
  shouldEnqueueOfficeReview,
  soulOverlayFromWrite,
  teammatePrompt,
  thinkMcpServerId,
  toRoutineDto,
  withComputerOfficeTools,
  withOfficeExecuteDescription,
  writeInboxFile,
} from "@groxbot/core";
import { bots } from "@groxbot/db";
import { createNeonHttpDb } from "@groxbot/db/neon";
import { getCurrentAgent } from "agents";
import { AgentContextProvider } from "agents/experimental/memory/session";
import type { ToolSet } from "ai";
import { eq } from "drizzle-orm";
import { createBotComputer } from "./bot-computer-workspace.js";
import { createBundlingExecutor } from "./bot-execute.js";
import { KnowledgeConnector } from "./bot-knowledge.js";
import { bindToMarkdown, createPageTools } from "./bot-markdown.js";
import { WorkspaceMcpConnector } from "./bot-mcp-connector.js";
import { createPresentTool } from "./bot-present.js";
import { RoutinesConnector } from "./bot-routines-connector.js";
import { agentRuntimeSource, productEnv, type RuntimeSource } from "./env.js";
import { r2KnowledgeDisk } from "./knowledge-r2.js";
import type { SendEmailBinding } from "./mail.js";
import { mcpCallbackPage } from "./mcp-callback-page.js";

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
  if (
    error instanceof ComputerPathError ||
    error instanceof ComputerWriteError
  ) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ComputerFileError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  console.error("bot actor workspace", error);
  return Response.json(
    { error: "Could not read this computer." },
    { status: 500 },
  );
}

function routineHttpError(error: unknown): Response {
  if (error instanceof RoutineNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof RoutineScheduleError || error instanceof RoutineError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  console.error("bot actor routine", error);
  return Response.json(
    { error: "Could not save that routine." },
    { status: 500 },
  );
}

const ROUTINE_CALLBACK = "runScheduledRoutine" as const;
const PAUSED_ROUTINES_STORAGE = "pausedRoutines";

type RoutineSchedulePayload = {
  name: string;
  prompt: string;
  timezone: string;
  schedule: string;
  cron?: string;
  intervalSeconds?: number;
  createdAt?: number;
};

type ParkedRoutine = RoutineSchedulePayload & { fireOnUnarchive: boolean };

function routinePayload(value: unknown): RoutineSchedulePayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.name !== "string" || typeof row.prompt !== "string") {
    return null;
  }
  if (typeof row.schedule !== "string") return null;
  return {
    name: row.name,
    prompt: row.prompt,
    timezone:
      typeof row.timezone === "string"
        ? row.timezone
        : DEFAULT_ROUTINE_TIMEZONE,
    schedule: row.schedule,
    cron: typeof row.cron === "string" ? row.cron : undefined,
    intervalSeconds:
      typeof row.intervalSeconds === "number" ? row.intervalSeconds : undefined,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : undefined,
  };
}

function routinePayloadFromCreate(input: {
  name: string;
  prompt: string;
  cron: string;
  timezone?: string;
}): RoutineSchedulePayload {
  const { name, prompt, parsed, when } = prepareRoutineCreate(input);
  return {
    name,
    prompt,
    timezone: parsed.timezone,
    schedule: parsed.schedule,
    createdAt: Date.now(),
    ...(when.kind === "cron"
      ? { cron: when.cron }
      : { intervalSeconds: when.intervalSeconds }),
  };
}

function storedRoutine(
  id: string,
  payload: RoutineSchedulePayload,
  active: boolean,
): StoredRoutine {
  return {
    id,
    name: payload.name,
    prompt: payload.prompt,
    schedule: payload.schedule,
    timezone: payload.timezone,
    active,
    createdAt: payload.createdAt ?? 0,
    updatedAt: payload.createdAt ?? 0,
  };
}

export class BotActor extends Think<WorkerEnv> {
  computer = createBotComputer({
    storage: this.ctx.storage,
    loader: this.env.LOADER,
    ctx: this.ctx,
  });
  /** Computer VFS only — Think never gets its own `@cloudflare/shell` disk. */
  override workspace = diskFromComputerFs(this.computer.fs);
  /** Computer Worker shell owns bash; do not merge Think `workspaceBash`. */
  override workspaceBash = false;
  override messageConcurrency: MessageConcurrency = "queue";
  /** MCP is tools.* / named connectors inside execute, not a dumped AI SDK catalog. */
  override includeMcpTools = false;
  override waitForMcpConnections = { timeout: MCP_OAUTH_SETTLE_MS };
  private soulPrompt = "You are a helpful teammate.";
  private turnModel = HOSTED_STARTER_MODEL;
  private turnHosted = true;
  private turnEnv: RuntimeSource = {};
  /** Memory writes wait in SQLite until we refresh the frozen prompt. */
  private memoryDirty = false;
  private botLoaded = false;
  private botLoading: Promise<void> | null = null;
  private officeId = "";
  /** Claimed a due review; other waitUntil callbacks should not start another. */
  private reviewQueued = false;
  /** saveMessages review turn in flight. */
  private reviewBusy = false;

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
    const slash = officeSkillSlashTurn({
      system: rewriteThinkCapability(ctx.system),
      messages: ctx.messages,
      continuation: ctx.continuation,
      hasActivateSkill: "activate_skill" in ctx.tools,
    });
    return slash.forceActivate
      ? {
          system: slash.system,
          toolChoice: { type: "tool" as const, toolName: "activate_skill" },
        }
      : { system: slash.system };
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

  async onChatResponse(result: ChatResponseResult): Promise<void> {
    await this.flushMemory();
    this.enqueueOfficeReview(result);
  }

  async onStart(): Promise<void> {
    const stored = await this.ctx.storage.get<string>("officeId");
    if (typeof stored === "string" && stored && !this.officeId) {
      this.officeId = stored;
    }
    this.ensureMcpOAuthCallback();
    this.sql`DROP TABLE IF EXISTS groxbot_routines`;
    await this.healComputerFiles();
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
    return session
      .withContext("soul", {
        description:
          "Who you are and how you sound. Starts as your name plus how this office works. Grow it with set_context as you learn this desk. Keep it dense. Keep your name. Facts about people and work go in memory.",
        maxTokens: 2000,
        provider: {
          get: async () => {
            // Do not block Think hydrate / get-messages on Neon. Chat turns
            // still wait in beforeTurn; loadBot refreshes the prompt after.
            void this.ensureBotLoaded();
            return composeSoul(this.soulPrompt, (await evolved.get()) ?? "");
          },
          set: async (content: string) => {
            await evolved.set(soulOverlayFromWrite(this.soulPrompt, content));
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
    const connectors = this.executeConnectors();
    const execute = createExecuteTool(this, {
      executor: createBundlingExecutor(this.env.LOADER, { timeout: 120_000 }),
      session: { mode: "reuse", key: this.name },
      tools: pageTools,
      connectors,
    });
    const description =
      typeof execute.description === "string" ? execute.description : "";
    const mcp = connectors
      .filter((row) => row instanceof WorkspaceMcpConnector)
      .map((row) => row.name());
    return {
      ...withComputerOfficeTools(
        createAITools({
          workspace: this.computer,
          shell: computerWorkerShell(),
        }),
      ),
      ...pageTools,
      present: createPresentTool(),
      execute: {
        ...execute,
        description: withOfficeExecuteDescription(
          description,
          Boolean(this.env.KNOWLEDGE),
          { routines: true, mcp },
        ),
      },
    };
  }

  /** Worker shell HOST (`WorkspaceServiceProxy`) reaches this DO’s Computer VFS. */
  async __getWorkspaceStub() {
    await this.computer.ready();
    return this.computer.stub();
  }

  async getSkills() {
    // Think hydrates skills before BotActor.onStart. Load officeId first or
    // office playbooks never enter the catalog (slash menu still lists them).
    await this.ensureOfficeId();
    return officeThinkSkillSources({
      knowledge: this.officeKnowledge(),
      officeId: this.officeId,
      workspace: this.workspace,
    });
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
    if (request.method === "POST" && url.pathname === "/routines/list") {
      return this.handleRoutinesList();
    }
    if (request.method === "POST" && url.pathname === "/routines/create") {
      return this.handleRoutinesCreate(request);
    }
    if (request.method === "POST" && url.pathname === "/routines/pause") {
      return this.handleRoutinesSetActive(request, false);
    }
    if (request.method === "POST" && url.pathname === "/routines/resume") {
      return this.handleRoutinesSetActive(request, true);
    }
    if (request.method === "POST" && url.pathname === "/routines/remove") {
      return this.handleRoutinesRemove(request);
    }
    if (request.method === "POST" && url.pathname === "/routines/suspend") {
      return this.handleRoutinesSuspend(request);
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

  private async ensureOfficeId(): Promise<void> {
    if (this.officeId) return;
    const stored = await this.ctx.storage.get<string>("officeId");
    if (typeof stored === "string" && stored) {
      this.officeId = stored;
      return;
    }
    await this.ensureBotLoaded();
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
    await this.ctx.storage.put("officeId", bot.workspaceId);
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

  private async healComputerFiles() {
    patchComputerWorkspace(this.workspace);
    healThinkWorkspaceFileRows(this.ctx.storage.sql);
    await this.ensureComputerDisk();
  }

  private async ensureComputerDisk() {
    const flag = await this.ctx.storage.get<string>(COMPUTER_DISK_FLAG);
    if (flag === COMPUTER_DISK_DOFS) return;
    await copyThinkWorkspaceToComputer({
      sql: this.ctx.storage.sql,
      disk: this.workspace,
    });
    await this.ctx.storage.put(COMPUTER_DISK_FLAG, COMPUTER_DISK_DOFS);
  }

  private async handleWorkspaceList(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as { path?: unknown };
    const path = typeof body.path === "string" ? body.path : "";
    const t0 = Date.now();
    try {
      await this.healComputerFiles();
      const listed = await listComputerEntries(this.workspace, path);
      console.log(
        `[bot ${this.name}] workspace list ${listed.entries.length} +${Date.now() - t0}ms`,
      );
      return Response.json(listed);
    } catch (error) {
      console.error(
        `[bot ${this.name}] workspace list +${Date.now() - t0}ms`,
        error,
      );
      return workspaceError(error);
    }
  }

  private async handleWorkspaceRead(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as { path?: unknown };
    const path = typeof body.path === "string" ? body.path : "";
    try {
      await this.healComputerFiles();
      return Response.json(await readComputerFile(this.workspace, path));
    } catch (error) {
      return workspaceError(error);
    }
  }

  private async handleWorkspaceDownload(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as { path?: unknown };
    const path = typeof body.path === "string" ? body.path : "";
    try {
      await this.healComputerFiles();
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
      await this.healComputerFiles();
      const bytes = decodeComputerBytes(content);
      return Response.json(
        await writeInboxFile(this.workspace, filename, bytes),
      );
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

  /**
   * After enough tool work, same Think brain files a playbook if one belongs
   * in the office. waitUntil + a 0-timer lets auto-continue admit first;
   * saveMessages then queues behind that stretch. The trigger user is hidden;
   * a real write shows one line with the path.
   */
  private enqueueOfficeReview(result: ChatResponseResult): void {
    this.ctx.waitUntil(this.maybeRunOfficeReview(result));
  }

  private async maybeRunOfficeReview(
    result: ChatResponseResult,
  ): Promise<void> {
    await this.bumpOfficeReviewTools(result);
    if (result.status !== "completed") return;
    if (!this.officeKnowledge()) return;
    if (!assistantTurnSettled(result.message?.parts)) return;
    const dueNow = parseOfficeReviewCounters(
      await this.ctx.storage.get(OFFICE_REVIEW_STORAGE),
    );
    if (
      !shouldEnqueueOfficeReview({
        status: result.status,
        reviewBusy: this.reviewBusy || this.reviewQueued,
        hasOfficeKnowledge: true,
        settled: true,
        counters: dueNow,
      })
    ) {
      return;
    }
    this.reviewQueued = true;
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const counters = parseOfficeReviewCounters(
        await this.ctx.storage.get(OFFICE_REVIEW_STORAGE),
      );
      if (
        this.reviewBusy ||
        !officeReviewDue(counters) ||
        !this.officeKnowledge()
      ) {
        return;
      }
      this.reviewBusy = true;
      try {
        await this.ctx.storage.put(
          OFFICE_REVIEW_STORAGE,
          emptyOfficeReviewCounters(),
        );
        await this.saveMessages((messages) => [
          ...messages,
          officeReviewUserMessage(),
        ]);
      } catch (error) {
        await this.ctx.storage.put(OFFICE_REVIEW_STORAGE, counters);
        console.error("bot actor office review", this.name, error);
      } finally {
        this.reviewBusy = false;
      }
    } finally {
      this.reviewQueued = false;
    }
  }

  private async bumpOfficeReviewTools(
    result: ChatResponseResult,
  ): Promise<void> {
    if (result.status !== "completed") return;
    if (this.reviewBusy) return;
    const tools = countUiToolParts(result.message?.parts);
    const current = parseOfficeReviewCounters(
      await this.ctx.storage.get(OFFICE_REVIEW_STORAGE),
    );
    const next = applyOfficeReviewTurn(current, tools, result.continuation);
    if (
      next.toolIters === current.toolIters &&
      next.lastMessageTools === current.lastMessageTools
    ) {
      return;
    }
    await this.ctx.storage.put(OFFICE_REVIEW_STORAGE, next);
  }

  /**
   * Agents `this.schedule` callback. Cron/interval rows live in
   * `cf_agents_schedules` — not a Groxbot table.
   */
  async runScheduledRoutine(payload: RoutineSchedulePayload): Promise<void> {
    const body = routinePayload(payload);
    if (!body) return;
    if (await this.routinesSuspended()) return;
    await this.submitMessages([
      {
        id: crypto.randomUUID(),
        role: "user",
        parts: [
          { type: "text", text: formatRoutinePrompt(body.name, body.prompt) },
        ],
        createdAt: new Date(),
        metadata: { source: "routine", custom: { source: "routine" } },
      },
    ]);
  }

  async listRoutines(): Promise<Routine[]> {
    const live = await this.liveRoutineSchedules();
    const parked = await this.parkedRoutines();
    const rows: Routine[] = live.map((row) =>
      toRoutineDto(
        this.name,
        storedRoutine(row.id, row.payload, true),
        isoUnixSeconds(row.time),
      ),
    );
    for (const [id, payload] of Object.entries(parked)) {
      if (live.some((row) => row.id === id)) continue;
      rows.push(
        toRoutineDto(this.name, storedRoutine(id, payload, false), null),
      );
    }
    return rows;
  }

  async createRoutine(input: {
    name: string;
    prompt: string;
    cron: string;
    timezone?: string;
  }): Promise<Routine> {
    const payload = routinePayloadFromCreate(input);
    if (await this.routinesSuspended()) {
      const id = newId();
      await this.putParkedRoutine(id, { ...payload, fireOnUnarchive: true });
      return toRoutineDto(this.name, storedRoutine(id, payload, true), null);
    }
    const row = await this.armRoutine(payload);
    return toRoutineDto(
      this.name,
      storedRoutine(row.id, payload, true),
      isoUnixSeconds(row.time),
    );
  }

  async pauseRoutine(id: string): Promise<Routine> {
    const live = await this.liveRoutineById(id);
    if (live) {
      await this.putParkedRoutine(id, {
        ...live.payload,
        fireOnUnarchive: false,
      });
      await this.cancelSchedule(id);
      return toRoutineDto(
        this.name,
        storedRoutine(id, live.payload, false),
        null,
      );
    }
    const parked = (await this.parkedRoutines())[id];
    if (!parked) throw new RoutineNotFoundError();
    return toRoutineDto(this.name, storedRoutine(id, parked, false), null);
  }

  async resumeRoutine(id: string): Promise<Routine> {
    const parked = (await this.parkedRoutines())[id];
    if (!parked) {
      const live = await this.liveRoutineById(id);
      if (live) {
        return toRoutineDto(
          this.name,
          storedRoutine(live.id, live.payload, true),
          isoUnixSeconds(live.time),
        );
      }
      throw new RoutineNotFoundError();
    }
    if (await this.routinesSuspended()) {
      throw new RoutineError("This teammate is archived.");
    }
    const { fireOnUnarchive: _, ...payload } = parked;
    const row = await this.armRoutine(payload);
    await this.deleteParkedRoutine(id);
    return toRoutineDto(
      this.name,
      storedRoutine(row.id, payload, true),
      isoUnixSeconds(row.time),
    );
  }

  async removeRoutine(id: string): Promise<void> {
    const cancelled = await this.cancelSchedule(id);
    const parked = (await this.parkedRoutines())[id];
    if (parked) await this.deleteParkedRoutine(id);
    if (!cancelled && !parked) throw new RoutineNotFoundError();
  }

  async setRoutinesSuspended(suspended: boolean): Promise<void> {
    if (suspended) {
      for (const row of await this.liveRoutineSchedules()) {
        await this.putParkedRoutine(row.id, {
          ...row.payload,
          fireOnUnarchive: true,
        });
        await this.cancelSchedule(row.id);
      }
      await this.ctx.storage.put("routinesSuspended", true);
      return;
    }
    await this.ctx.storage.put("routinesSuspended", false);
    const parked = await this.parkedRoutines();
    for (const [id, row] of Object.entries(parked)) {
      if (!row.fireOnUnarchive) continue;
      const { fireOnUnarchive: _, ...payload } = row;
      await this.armRoutine(payload);
      await this.deleteParkedRoutine(id);
    }
  }

  private async armRoutine(payload: RoutineSchedulePayload) {
    if (payload.intervalSeconds) {
      return this.scheduleEvery(
        payload.intervalSeconds,
        ROUTINE_CALLBACK,
        payload,
      );
    }
    if (!payload.cron) throw new RoutineScheduleError();
    return this.schedule(payload.cron, ROUTINE_CALLBACK, payload);
  }

  private async liveRoutineSchedules(): Promise<
    Array<{ id: string; time: number; payload: RoutineSchedulePayload }>
  > {
    const rows = await this.listSchedules();
    const out: Array<{
      id: string;
      time: number;
      payload: RoutineSchedulePayload;
    }> = [];
    for (const row of rows) {
      if (row.callback !== ROUTINE_CALLBACK) continue;
      const payload = routinePayload(row.payload);
      if (!payload) continue;
      out.push({ id: row.id, time: row.time, payload });
    }
    return out;
  }

  private async liveRoutineById(id: string) {
    return (
      (await this.liveRoutineSchedules()).find((row) => row.id === id) ?? null
    );
  }

  private async parkedRoutines(): Promise<Record<string, ParkedRoutine>> {
    const raw =
      (await this.ctx.storage.get<Record<string, ParkedRoutine>>(
        PAUSED_ROUTINES_STORAGE,
      )) ?? {};
    return raw && typeof raw === "object" ? raw : {};
  }

  private async putParkedRoutine(
    id: string,
    row: ParkedRoutine,
  ): Promise<void> {
    const next = { ...(await this.parkedRoutines()), [id]: row };
    await this.ctx.storage.put(PAUSED_ROUTINES_STORAGE, next);
  }

  private async deleteParkedRoutine(id: string): Promise<void> {
    const next = { ...(await this.parkedRoutines()) };
    delete next[id];
    await this.ctx.storage.put(PAUSED_ROUTINES_STORAGE, next);
  }

  private async handleRoutinesList(): Promise<Response> {
    try {
      return Response.json({ routines: await this.listRoutines() });
    } catch (error) {
      return routineHttpError(error);
    }
  }

  private async handleRoutinesCreate(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      prompt?: unknown;
      cron?: unknown;
      timezone?: unknown;
    };
    try {
      return Response.json(
        await this.createRoutine({
          name: typeof body.name === "string" ? body.name : "",
          prompt: typeof body.prompt === "string" ? body.prompt : "",
          cron: typeof body.cron === "string" ? body.cron : "",
          timezone:
            typeof body.timezone === "string" ? body.timezone : undefined,
        }),
      );
    } catch (error) {
      return routineHttpError(error);
    }
  }

  private async handleRoutinesSetActive(
    request: Request,
    active: boolean,
  ): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    try {
      return Response.json(
        active ? await this.resumeRoutine(id) : await this.pauseRoutine(id),
      );
    } catch (error) {
      return routineHttpError(error);
    }
  }

  private async handleRoutinesRemove(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    try {
      await this.removeRoutine(id);
      return Response.json({ ok: true });
    } catch (error) {
      return routineHttpError(error);
    }
  }

  private async handleRoutinesSuspend(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as {
      suspended?: unknown;
    };
    try {
      await this.setRoutinesSuspended(body.suspended === true);
      return Response.json({ ok: true });
    } catch (error) {
      return routineHttpError(error);
    }
  }

  private async routinesSuspended(): Promise<boolean> {
    return (await this.ctx.storage.get<boolean>("routinesSuspended")) === true;
  }

  private executeConnectors() {
    const connectors: Array<
      KnowledgeConnector | WorkspaceMcpConnector | RoutinesConnector
    > = [new RoutinesConnector(this.ctx, this.env, () => this)];
    if (this.env.KNOWLEDGE) {
      connectors.push(
        new KnowledgeConnector(
          this.ctx,
          this.env,
          r2KnowledgeDisk(this.env.KNOWLEDGE),
          () => this.officeId,
        ),
      );
    }
    connectors.push(...this.mcpExecuteConnectors());
    return connectors;
  }

  private mcpExecuteConnectors(): WorkspaceMcpConnector[] {
    const servers = this.getMcpServers().servers;
    const connections = this.mcp.mcpConnections as Record<
      string,
      { connectionState?: string; name?: string } | undefined
    >;
    return mcpServersForExecute(servers, connections).flatMap(
      ({ id, name }) => {
        const connection = this.mcp.mcpConnections[id];
        if (!connection) return [];
        return [
          new WorkspaceMcpConnector(this.ctx, this.env, connection, name),
        ];
      },
    );
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
      return Response.json(
        { error: "MCP server is missing fields." },
        { status: 400 },
      );
    }
    try {
      const result = await this.addMcpServer(name, url, {
        id: thinkMcpServerId(serverId),
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
      await this.removeMcpServer(thinkMcpServerId(serverId));
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
    if (result.authSuccess) {
      try {
        await this.mcp.waitForConnections({ timeout: MCP_OAUTH_SETTLE_MS });
        const state = (
          this.mcp.mcpConnections[result.serverId] as
            | { connectionState?: string }
            | undefined
        )?.connectionState;
        if (!mcpConnectionIsExecutable(state)) {
          await this.mcp.establishConnection(result.serverId);
        }
      } catch (error) {
        console.error("bot actor mcp wait", this.name, error);
      }
    }
    const live = this.mcp.mcpConnections[result.serverId] as
      | { connectionState?: string; connectionError?: string | null }
      | undefined;
    const catalog = mcpCatalogStatusFromThink(
      live?.connectionState,
      result.authSuccess,
    );
    try {
      const env = productEnv(this.env);
      const { db } = createNeonHttpDb(env.databaseUrl);
      await saveMcpConnection(db, result.serverId, {
        status: catalog.status,
        lastError: result.authSuccess
          ? (catalog.lastError ?? live?.connectionError ?? null)
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
