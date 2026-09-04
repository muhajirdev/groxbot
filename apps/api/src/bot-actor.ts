/** Cloudflare-only. Excluded from `tsc`. Disk is Computer; office chat is Pi over Cap'n Web. */
import { createAITools } from "@cloudflare/computer/tools";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { WorkersAiBinding } from "@groxbot/adapters/edge";
import {
  appendOfficeUserText,
  DurableSessionStorage,
  gatewayConfigured,
  gatewayRequestModel,
  loadGatewayConfig,
  migrateOfficeChatToSession,
  persistOfficeSessionEvent,
  piBoundFromSessionEntries,
  piCompletionsModel,
  resolvePiAiModel,
  resolvePiStreamFn,
  runPiTurn,
  Session,
  sqliteSessionStore,
} from "@groxbot/adapters/edge";
import {
  HOSTED_STARTER_MODEL,
  labelForModel,
  OFFICE_INTRO_SOURCE,
  OFFICE_REVIEW_SOURCE,
  officeUserFromHeaders,
  type Routine,
  stampIncomingOfficeUser,
} from "@groxbot/contracts";
import {
  applyOfficeReviewTurn,
  applyOfficeSkillsToSystem,
  buildOfficeSystemPrompt,
  ComputerFileError,
  ComputerPathError,
  ComputerWriteError,
  composeSoul,
  computerWorkerShell,
  countPiToolCallsSinceLastUser,
  DEFAULT_ROUTINE_TIMEZONE,
  decodeComputerBytes,
  diskFromComputerFs,
  downloadComputerFile,
  emptyOfficeReviewCounters,
  encryptionSecret,
  ensureComputerHome,
  formatRoutinePrompt,
  isoUnixSeconds,
  jsonClone,
  lastOfficeUserIsIntro,
  listComputerEntries,
  loadOfficeSkillCatalog,
  MCP_OAUTH_SETTLE_MS,
  mcpCatalogStatusFromLive,
  mcpConnectionIsExecutable,
  mcpServerId,
  mcpServersForExecute,
  newId,
  OFFICE_GENERATION_STORAGE,
  OFFICE_INTRO_STORAGE,
  OFFICE_REVIEW_STORAGE,
  OFFICE_WORKSPACE_HEADER,
  type OfficeChatMessage,
  type OfficeHistorySearch,
  officeCanReadSkills,
  officeIntroTurnTools,
  officeIntroUserText,
  officeReviewDue,
  officeReviewUserText,
  parseOfficeChatMessages,
  parseOfficeReviewCounters,
  parseTinyfishKeys,
  patchComputerWorkspace,
  piAssistantTurnSettled,
  type PiBoundMessage,
  type PiClientEvent,
  type PiOfficeSnapshot,
  type PiSendMessageInput,
  piLogShouldRun,
  PiSteerQueue,
  piQueuedUserBound,
  takePiAssistantDraft,
  prepareRoutineCreate,
  RoutineError,
  RoutineNotFoundError,
  RoutineScheduleError,
  readComputerFile,
  resolveRunModel,
  type StoredRoutine,
  saveMcpConnection,
  searchOfficeHistory,
  shouldEnqueueOfficeReview,
  shouldRunOfficeIntro,
  soulOverlayFromWrite,
  teammatePrompt,
  TinyfishKeyPool,
  tinyfishPoolStart,
  toRoutineDto,
  withComputerOfficeTools,
  withOfficeExecuteDescription,
  writeInboxFile,
} from "@groxbot/core";
import { bots } from "@groxbot/db";
import { createNeonHttpDb } from "@groxbot/db/neon";
import { Agent } from "agents";
import { AgentContextProvider } from "agents/experimental/memory/session";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { createBotComputer } from "./bot-computer-workspace.js";
import {
  createBundlingExecutor,
  createOfficeExecuteTool,
} from "./bot-execute.js";
import { HistoryConnector } from "./bot-history.js";
import { KnowledgeConnector } from "./bot-knowledge.js";
import { bindToMarkdown, createPageAgentTools } from "./bot-markdown.js";
import { WorkspaceMcpConnector } from "./bot-mcp-connector.js";
import {
  type OfficeChatSubscriber,
  officeRpcResponse,
} from "./bot-office-rpc.js";
import { aiToolsToPi, officeAgentTool } from "./bot-office-tools.js";
import { createPresentTool } from "./bot-present.js";
import { createSkillTool } from "./bot-skill.js";
import { RoutinesConnector } from "./bot-routines-connector.js";
import { agentRuntimeSource, productEnv, type RuntimeSource } from "./env.js";
import { r2KnowledgeDisk } from "./knowledge-r2.js";
import type { SendEmailBinding } from "./mail.js";
import { mcpCallbackPage } from "./mcp-callback-page.js";
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
  TINYFISH_API_KEY?: string;
  TINYFISH_API_KEYS?: string;
  EMAIL?: SendEmailBinding;
  AI?: WorkersAiBinding;
  APP_RUNTIME: DurableObjectNamespace;
  ROOM_ACTOR: DurableObjectNamespace;
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
const OFFICE_TIMEZONE_STORAGE = "officeTimezone";

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

export class RoomHome extends Agent<WorkerEnv> {
  computer = createBotComputer({
    storage: this.ctx.storage,
    loader: this.env.LOADER,
    ctx: this.ctx,
    binding: "ROOM_ACTOR",
  });
  /** Computer VFS — Code Mode execute and the office pane share this tree. */
  workspace = diskFromComputerFs(this.computer.fs);
  private soulPrompt = "You are a helpful teammate.";
  private hireName = "";
  private turnModel = HOSTED_STARTER_MODEL;
  private turnEnv: RuntimeSource = {};
  private botLoaded = false;
  private botLoading: Promise<void> | null = null;
  protected officeId = "";
  /** Product bot id. DO instance name is the home room id. */
  protected personId = "";
  /** Claimed a due review; other waitUntil callbacks should not start another. */
  private reviewQueued = false;
  /** Office review turn in flight. */
  private reviewBusy = false;
  private soulOverlay = new AgentContextProvider(this, "soul-evolved");
  private memoryBlock = new AgentContextProvider(this, "memory");
  private officeSubscribers = new Set<OfficeChatSubscriber>();
  private officeStatus: "ready" | "submitted" | "streaming" | "error" = "ready";
  private officeError = "";
  private officeTurn: AbortController | null = null;
  private officeQueue: Promise<void> = Promise.resolve();
  private officeSteer = new PiSteerQueue();
  private officeSession: Session | null = null;
  private officeSeq = 0;
  private tinyfishKeys: TinyfishKeyPool | null = null;

  async onStart(): Promise<void> {
    const stored = await this.ctx.storage.get<string>("officeId");
    if (typeof stored === "string" && stored && !this.officeId) {
      this.officeId = stored;
    }
    this.ensureMcpOAuthCallback();
    this.sql`DROP TABLE IF EXISTS groxbot_routines`;
    this.sql`CREATE TABLE IF NOT EXISTS office_chat (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      payload TEXT NOT NULL
    )`;
    await this.ensureOfficeSession();
    await this.healComputerFiles();
    console.log(`[bot ${this.name}] onStart`);
  }

  private pageTinyfishPool(): TinyfishKeyPool {
    if (!this.tinyfishKeys) {
      const keys = parseTinyfishKeys(this.env);
      this.tinyfishKeys = new TinyfishKeyPool(
        keys,
        tinyfishPoolStart(this.name, keys.length),
      );
    }
    return this.tinyfishKeys;
  }

  getAgentTools(): AgentTool[] {
    const page = {
      workspace: this.workspace,
      convert: bindToMarkdown(this.env.AI),
      tinyfishKeys: this.pageTinyfishPool(),
    };
    const connectors = this.executeConnectors();
    const execute = createOfficeExecuteTool({
      ctx: this.ctx,
      executor: createBundlingExecutor(this.env.LOADER, { timeout: 120_000 }),
      page,
      connectors,
    });
    const mcp = connectors
      .filter((row) => row instanceof WorkspaceMcpConnector)
      .map((row) => row.name());
    const knowledge = this.officeKnowledge();
    const skill =
      knowledge && this.officeId
        ? createSkillTool({
            disk: knowledge,
            workspaceId: () => this.officeId,
          })
        : null;
    return [
      ...aiToolsToPi(
        withComputerOfficeTools(
          createAITools({
            workspace: this.computer,
            shell: computerWorkerShell(),
          }),
        ),
      ),
      ...createPageAgentTools(page),
      createPresentTool(),
      this.setContextTool(),
      ...(skill ? [skill] : []),
      {
        ...execute,
        description: withOfficeExecuteDescription(
          typeof execute.description === "string" ? execute.description : "",
          Boolean(this.env.KNOWLEDGE),
          { history: true, routines: true, mcp },
        ),
      },
    ];
  }

  /** Worker shell HOST (`WorkspaceServiceProxy`) reaches this DO’s Computer VFS. */
  async __getWorkspaceStub() {
    await this.computer.ready();
    return this.computer.stub();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (
      request.headers.get("Upgrade") === "websocket" &&
      url.pathname.endsWith("/rpc")
    ) {
      await this.ensureOfficeId();
      const claimed = request.headers.get(OFFICE_WORKSPACE_HEADER);
      if (!this.officeId || claimed !== this.officeId) {
        return new Response("Forbidden", { status: 403 });
      }
      return officeRpcResponse(
        this,
        request,
        officeUserFromHeaders(request.headers),
      );
    }
    if (request.method === "POST" && url.pathname === "/wakeup") {
      return this.handleWakeup(request);
    }
    if (request.method === "POST" && url.pathname === "/door/context") {
      return this.handleDoorContext(request);
    }
    if (request.method === "POST" && url.pathname === "/door/tools") {
      return this.handleDoorTools(request);
    }
    if (request.method === "POST" && url.pathname === "/door/tool") {
      return this.handleDoorTool(request);
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

  async subscribeOffice(subscriber: OfficeChatSubscriber): Promise<void> {
    const live = subscriber.dup?.() ?? subscriber;
    this.officeSubscribers.add(live);
    live.onRpcBroken?.(() => {
      this.officeSubscribers.delete(live);
    });
    const generation =
      (await this.ctx.storage.get<number>(OFFICE_GENERATION_STORAGE)) ?? 0;
    await live.streamGeneration(generation);
    const startIntro = await this.prepareOfficeIntro();
    const snapshot = jsonClone(await this.officeSnapshot());
    if (snapshot) {
      await live.event({
        type: "snapshot",
        snapshot,
        threadId: this.name,
        seq: this.officeSeq,
      });
    }
    if (this.officeError) await live.error(this.officeError);
    await live.status(this.officeStatus);
    if (startIntro) this.ctx.waitUntil(this.enqueueOfficeTurn());
  }

  async officeSnapshot(): Promise<PiOfficeSnapshot> {
    const session = await this.ensureOfficeSession();
    const status =
      this.officeStatus === "error"
        ? "failed"
        : this.officeStatus === "ready"
          ? "idle"
          : "running";
    const snapshot: PiOfficeSnapshot = {
      metadata: { id: this.name, status },
      messages: [
        ...(await this.officeBound(session)),
        ...this.officeSteer.pending().map(piQueuedUserBound),
      ],
    };
    if (this.officeError) snapshot.lastError = this.officeError;
    return snapshot;
  }

  async sendOffice(
    input: PiSendMessageInput,
    user: ReturnType<typeof officeUserFromHeaders>,
  ): Promise<void> {
    const session = await this.ensureOfficeSession();
    const id = input.id?.trim() || crypto.randomUUID();
    const existing = (await this.officeBound(session)).find(
      (row) => row.id === id,
    );
    const running = Boolean(
      this.officeTurn && !this.officeTurn.signal.aborted,
    );
    const stamped = stampIncomingOfficeUser(
      { role: "user", metadata: input.metadata },
      user,
      existing,
    );
    if (running) {
      this.officeSteer.push({
        id,
        content: input.content,
        metadata: stamped.metadata,
        timestamp: Date.now(),
      });
      await this.broadcastOfficeEvent({
        type: "message_end",
        id,
        message: {
          role: "user",
          content: input.content,
          timestamp: Date.now(),
        },
        metadata: stamped.metadata,
      });
      return;
    }
    await appendOfficeUserText(session, {
      id,
      content: input.content,
      metadata: stamped.metadata,
    });
    await this.broadcastOfficeEvent({
      type: "message_end",
      id,
      message: {
        role: "user",
        content: input.content,
        timestamp: Date.now(),
      },
      metadata: stamped.metadata,
    });
    const bound = await this.officeBound(session);
    if (!piLogShouldRun(bound)) {
      this.officeStatus = "ready";
      await this.broadcastOfficeStatus();
      return;
    }
    this.ctx.waitUntil(this.enqueueOfficeTurn());
  }

  async stopOffice(): Promise<void> {
    this.officeTurn?.abort();
    this.officeTurn = null;
    const leftover = this.officeSteer.takeAll();
    if (leftover.length) {
      const session = await this.ensureOfficeSession();
      for (const row of leftover) {
        await appendOfficeUserText(session, row);
      }
    }
    this.officeStatus = "ready";
    await this.broadcastOfficeStatus();
  }

  async appendOfficeUserAndRun(input: {
    id: string;
    content: string;
    metadata?: unknown;
  }): Promise<void> {
    const session = await this.ensureOfficeSession();
    await appendOfficeUserText(session, input);
    await this.broadcastOfficeEvent({
      type: "message_end",
      id: input.id,
      message: {
        role: "user",
        content: input.content,
        timestamp: Date.now(),
      },
      metadata: input.metadata,
    });
    await this.enqueueOfficeTurn();
  }

  private enqueueOfficeTurn(): Promise<void> {
    return this.enqueueTurn(() => this.runOfficeTurn());
  }

  private enqueueTurn(work: () => Promise<void>): Promise<void> {
    const run = this.officeQueue.then(work);
    this.officeQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async runOfficeTurn(): Promise<void> {
    this.officeTurn?.abort();
    const abort = new AbortController();
    this.officeTurn = abort;
    this.officeError = "";
    this.officeStatus = "submitted";
    await this.bumpOfficeGeneration();
    await this.broadcastOfficeStatus();
    await this.ensureBotLoaded();
    if (abort.signal.aborted) return;
    await this.healComputerFiles();
    const session = await this.ensureOfficeSession();
    const streamFn = this.turnStreamFn();
    if (!streamFn) {
      this.officeStatus = "error";
      this.officeError =
        "Add a model key, or use Groxbot’s included gateway, to talk to teammates.";
      await this.broadcastOfficeError();
      await this.broadcastOfficeStatus();
      return;
    }
    const assistantDraft: { id?: string } = {};
    this.officeStatus = "streaming";
    await this.broadcastOfficeStatus();
    const model = this.turnPiModel();
    const bound = await this.officeBound(session);
    const intro = lastOfficeUserIsIntro(bound);
    const tools = intro
      ? officeIntroTurnTools(this.getAgentTools())
      : this.getAgentTools();
    const system = await this.officeSystemPrompt(bound, tools);
    try {
      const context = await session.buildContext();
      const result = await runPiTurn({
        systemPrompt: system,
        messages: context.messages,
        model,
        streamFn,
        tools,
        signal: abort.signal,
        getSteeringMessages: () =>
          intro ? [] : this.officeSteer.drainMessages(),
        getFollowUpMessages: () =>
          intro ? [] : this.officeSteer.drainMessages(),
        onEvent: async (event) => {
          const incoming =
            "message" in event && event.message ? event.message : null;
          if (
            incoming?.role === "user" &&
            (event.type === "message_start" || event.type === "message_end")
          ) {
            const queued =
              event.type === "message_end"
                ? this.officeSteer.takeEmitted()
                : this.officeSteer.peekEmitted();
            if (event.type === "message_end" && queued) {
              await appendOfficeUserText(session, queued);
            }
            const cloned = jsonClone(event);
            if (!cloned) return;
            await this.broadcastOfficeEvent({
              ...cloned,
              ...(queued
                ? { id: queued.id, metadata: queued.metadata }
                : {}),
            });
            return;
          }
          const draftId = takePiAssistantDraft(assistantDraft, event);
          await persistOfficeSessionEvent(session, event, draftId);
          const cloned = jsonClone(event);
          if (!cloned) return;
          await this.broadcastOfficeEvent({
            ...cloned,
            ...(draftId &&
            (event.type === "message_update" ||
              event.type === "message_end" ||
              event.type === "message_start")
              ? { id: draftId }
              : {}),
          });
        },
      });
      if (result.stopReason === "aborted" || abort.signal.aborted) {
        this.officeStatus = "ready";
        await this.broadcastOfficeStatus();
        return;
      }
      if (result.stopReason === "error") {
        this.officeStatus = "error";
        this.officeError = result.errorMessage || "The model run failed.";
        await this.broadcastOfficeError();
        await this.broadcastOfficeStatus();
        return;
      }
      this.officeStatus = "ready";
      await this.broadcastOfficeStatus();
      this.enqueueOfficeReview({
        status: "completed",
        continuation: false,
      });
    } catch (error) {
      if (abort.signal.aborted) {
        this.officeStatus = "ready";
        await this.broadcastOfficeStatus();
        return;
      }
      this.officeStatus = "error";
      this.officeError =
        error instanceof Error ? error.message : "The model run failed.";
      await this.broadcastOfficeError();
      await this.broadcastOfficeStatus();
    } finally {
      if (this.officeTurn === abort) this.officeTurn = null;
      const leftover = this.officeSteer.takeAll();
      for (const row of leftover) {
        await appendOfficeUserText(session, row);
      }
      if (leftover.length && !abort.signal.aborted) {
        this.ctx.waitUntil(this.enqueueOfficeTurn());
      }
    }
  }

  private async requireDoorWorkspace(request: Request): Promise<boolean> {
    await this.ensureOfficeId();
    const claimed = request.headers.get(OFFICE_WORKSPACE_HEADER);
    return Boolean(this.officeId && claimed === this.officeId);
  }

  /** Other rooms read/write this person’s grown soul and memory. */
  private async handleDoorContext(request: Request): Promise<Response> {
    if (!(await this.requireDoorWorkspace(request))) {
      return new Response("Forbidden", { status: 403 });
    }
    await this.ensureBotLoaded();
    const body = (await request.json().catch(() => ({}))) as {
      op?: unknown;
      label?: unknown;
      content?: unknown;
      mode?: unknown;
    };
    if (body.op === "set") {
      const label = body.label === "soul" ? "soul" : "memory";
      const block = label === "soul" ? this.soulOverlay : this.memoryBlock;
      const previous = (await block.get()) ?? "";
      const text = typeof body.content === "string" ? body.content : "";
      const next =
        body.mode === "append" && previous
          ? `${previous.trim()}\n${text.trim()}`
          : text;
      await block.set(
        label === "soul"
          ? soulOverlayFromWrite(this.soulPrompt, next)
          : next.trim(),
      );
      return Response.json({ ok: true, label });
    }
    return Response.json({
      soulPrompt: this.soulPrompt,
      overlay: (await this.soulOverlay.get()) ?? "",
      memory: (await this.memoryBlock.get()) ?? "",
    });
  }

  private async handleDoorTools(request: Request): Promise<Response> {
    if (!(await this.requireDoorWorkspace(request))) {
      return new Response("Forbidden", { status: 403 });
    }
    await this.ensureBotLoaded();
    await this.healComputerFiles();
    const tools = this.getAgentTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: jsonClone(tool.parameters) ?? { type: "object" },
    }));
    return Response.json({ tools });
  }

  private async handleDoorTool(request: Request): Promise<Response> {
    if (!(await this.requireDoorWorkspace(request))) {
      return new Response("Forbidden", { status: 403 });
    }
    await this.ensureBotLoaded();
    await this.healComputerFiles();
    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      params?: unknown;
      toolCallId?: unknown;
    };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const tool = this.getAgentTools().find((row) => row.name === name);
    if (!tool) {
      return Response.json({ error: `Unknown tool ${name}` }, { status: 404 });
    }
    const toolCallId =
      typeof body.toolCallId === "string" && body.toolCallId
        ? body.toolCallId
        : crypto.randomUUID();
    const args = tool.prepareArguments
      ? tool.prepareArguments(body.params)
      : body.params;
    const result = await tool.execute(toolCallId, args);
    return Response.json(jsonClone(result) ?? { content: [] });
  }

  private async officeSystemPrompt(
    messages: PiBoundMessage[],
    tools: Array<{ name: string; description?: string }>,
  ): Promise<string> {
    const overlay = (await this.soulOverlay.get()) ?? "";
    const memory = (await this.memoryBlock.get()) ?? "";
    let identity = composeSoul(this.soulPrompt, overlay);
    if (memory.trim()) identity = `${identity}\n\nMemory:\n${memory.trim()}`;
    return this.withOfficeSkills(
      buildOfficeSystemPrompt({ identity, tools }),
      messages.map((row) => row.message),
      { canReadSkills: officeCanReadSkills(tools) },
    );
  }

  protected async withOfficeSkills(
    system: string,
    messages: readonly unknown[],
    opts?: { canReadSkills?: boolean },
  ): Promise<string> {
    if (opts?.canReadSkills === false) return system;
    const disk = this.officeKnowledge();
    const catalog =
      disk && this.officeId
        ? await loadOfficeSkillCatalog(disk, this.officeId)
        : [];
    return applyOfficeSkillsToSystem({
      system,
      messages,
      catalog,
      canReadSkills: opts?.canReadSkills,
    });
  }

  private setContextTool(): AgentTool {
    return officeAgentTool({
      description:
        "Save who you are (soul) or short facts about this office (memory). Keep it dense. Keep your name on soul.",
      name: "set_context",
      parameters: z.object({
        label: z.enum(["soul", "memory"]),
        content: z.string(),
        mode: z.enum(["replace", "append"]).optional(),
      }),
      execute: async ({ label, content, mode }) => {
        const kind = label === "soul" ? "soul" : "memory";
        const block = kind === "soul" ? this.soulOverlay : this.memoryBlock;
        const previous = (await block.get()) ?? "";
        const text = String(content ?? "");
        const next =
          mode === "append" && previous
            ? `${previous.trim()}\n${text.trim()}`
            : text;
        await block.set(
          kind === "soul"
            ? soulOverlayFromWrite(this.soulPrompt, next)
            : next.trim(),
        );
        return { ok: true, label: kind };
      },
    });
  }

  private async officeBound(session: Session): Promise<PiBoundMessage[]> {
    return piBoundFromSessionEntries(
      await session.getBranch(),
      await session.getStorage().findEntries("custom"),
    );
  }

  async officeHistorySearch(
    query: string,
    limit?: number,
  ): Promise<OfficeHistorySearch> {
    const session = await this.ensureOfficeSession();
    return searchOfficeHistory(await this.officeBound(session), query, {
      limit,
      excludeLastUser: true,
    });
  }

  private readLegacyOfficeChat(): OfficeChatMessage[] {
    const rows = this.sql<{ payload: string }>`
      SELECT payload FROM office_chat ORDER BY seq ASC
    `;
    return parseOfficeChatMessages(
      rows.map((row) => {
        try {
          return JSON.parse(row.payload) as unknown;
        } catch {
          return null;
        }
      }),
    );
  }

  private async ensureOfficeSession(): Promise<Session> {
    if (this.officeSession) return this.officeSession;
    const storage = new DurableSessionStorage(
      sqliteSessionStore(this.ctx.storage.sql as never, {
        id: this.name,
        createdAt: new Date().toISOString(),
      }),
    );
    const session = new Session(storage);
    await migrateOfficeChatToSession(session, this.readLegacyOfficeChat());
    this.officeSession = session;
    return session;
  }

  private async bumpOfficeGeneration(): Promise<number> {
    const current =
      (await this.ctx.storage.get<number>(OFFICE_GENERATION_STORAGE)) ?? 0;
    const next = current > 0 ? current + 1 : 1;
    await this.ctx.storage.put(OFFICE_GENERATION_STORAGE, next);
    await this.broadcastOffice((sub) => sub.streamGeneration(next));
    return next;
  }

  private async broadcastOffice(
    fn: (subscriber: OfficeChatSubscriber) => void | Promise<void>,
  ): Promise<void> {
    for (const subscriber of [...this.officeSubscribers]) {
      try {
        await fn(subscriber);
      } catch {
        this.officeSubscribers.delete(subscriber);
      }
    }
  }

  private async broadcastOfficeEvent(
    event: Omit<PiClientEvent, "threadId" | "seq"> & { seq?: number },
  ): Promise<void> {
    this.officeSeq += 1;
    const payload = jsonClone({
      ...event,
      threadId: this.name,
      seq: event.seq ?? this.officeSeq,
    });
    if (!payload) return;
    await this.broadcastOffice((sub) => sub.event(payload));
  }

  private broadcastOfficeStatus(): Promise<void> {
    return this.broadcastOffice((sub) => sub.status(this.officeStatus));
  }

  private broadcastOfficeError(): Promise<void> {
    return this.broadcastOffice((sub) => sub.error(this.officeError));
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

  protected async ensureBotLoaded(): Promise<void> {
    if (this.botLoaded) return;
    if (!this.botLoading) {
      const t0 = Date.now();
      console.log(`[bot ${this.name}] loadBot begin`);
      this.botLoading = this.loadBot()
        .then(() => {
          this.botLoaded = true;
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

  /** Person iff this instance is someone’s `homeRoomId` (or stored `botId`). No stored kind. */
  protected async isPersonRoom(): Promise<boolean> {
    if (this.personId) return true;
    const stored = await this.ctx.storage.get<string>("botId");
    if (typeof stored === "string" && stored.trim()) {
      this.personId = stored.trim();
      return true;
    }
    await this.ensureBotLoaded();
    return Boolean(this.personId);
  }

  private botKey(): string {
    return this.personId || this.name;
  }

  private turnStreamFn() {
    return resolvePiStreamFn(this.turnEnv, {
      ai: this.env.AI,
      gatewayId: this.turnEnv.CLOUDFLARE_AI_GATEWAY_ID,
      metadata: {
        workspaceId: this.officeId,
        botId: this.botKey(),
      },
    });
  }

  private turnPiModel() {
    if (gatewayConfigured(this.turnEnv)) {
      return resolvePiAiModel(loadGatewayConfig(this.turnEnv), this.turnModel);
    }
    return piCompletionsModel(gatewayRequestModel(this.turnModel));
  }

  private async loadBot(): Promise<void> {
    const env = productEnv(this.env);
    const source = agentRuntimeSource(env);
    const { db } = createNeonHttpDb(env.databaseUrl);
    const [bot] = await db
      .select()
      .from(bots)
      .where(or(eq(bots.homeRoomId, this.name), eq(bots.id, this.name)))
      .limit(1);
    if (!bot) return;
    this.personId = bot.id;
    this.officeId = bot.workspaceId;
    this.hireName = bot.name;
    await this.ctx.storage.put("officeId", bot.workspaceId);
    await this.ctx.storage.put("botId", bot.id);
    const overlay = await resolveRunModel(
      db,
      bot,
      source,
      encryptionSecret(source, env.production),
    );
    this.turnModel = overlay.model || HOSTED_STARTER_MODEL;
    this.turnEnv = overlay.env;
    this.soulPrompt = teammatePrompt({
      ...bot,
      modelLabel: labelForModel(this.turnModel),
    });
  }

  private async healComputerFiles() {
    try {
      await this.computer.ready();
    } catch {
      // mkdir still works before backends connect.
    }
    await ensureComputerHome(this.computer.fs);
    patchComputerWorkspace(this.workspace);
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
      await this.stopOffice();
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
   * After enough tool work, the same Pi loop files a playbook if one belongs
   * in the office. The trigger user is hidden; a real write shows one line
   * with the path.
   */
  private enqueueOfficeReview(result: {
    status: string;
    continuation?: boolean;
  }): void {
    this.ctx.waitUntil(this.maybeRunOfficeReview(result));
  }

  /**
   * First open after hire: become the named person/role, write soul, greet.
   * Stamp the hidden user and mark submitted before the snapshot so the
   * client never paints an idle empty desk first.
   */
  private async prepareOfficeIntro(): Promise<boolean> {
    if (!(await this.isPersonRoom())) return false;
    if (await this.ctx.storage.get(OFFICE_INTRO_STORAGE)) return false;
    await this.ensureBotLoaded();
    if (!this.hireName.trim()) return false;
    if (!this.turnStreamFn()) return false;
    const session = await this.ensureOfficeSession();
    const bound = await this.officeBound(session);
    if (!shouldRunOfficeIntro(bound)) {
      await this.ctx.storage.put(OFFICE_INTRO_STORAGE, true);
      return false;
    }
    try {
      await appendOfficeUserText(session, {
        id: crypto.randomUUID(),
        content: officeIntroUserText({
          name: this.hireName,
        }),
        metadata: {
          source: OFFICE_INTRO_SOURCE,
          custom: { source: OFFICE_INTRO_SOURCE },
        },
      });
      await this.ctx.storage.put(OFFICE_INTRO_STORAGE, true);
      this.officeStatus = "submitted";
      return true;
    } catch (error) {
      console.error("bot actor office intro", this.name, error);
      return false;
    }
  }

  private async maybeRunOfficeReview(result: {
    status: string;
    continuation?: boolean;
  }): Promise<void> {
    await this.bumpOfficeReviewTools(result);
    if (result.status !== "completed") return;
    if (!this.officeKnowledge()) return;
    const session = await this.ensureOfficeSession();
    const bound = await this.officeBound(session);
    if (!piAssistantTurnSettled(bound)) return;
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
        await this.appendOfficeUserAndRun({
          id: crypto.randomUUID(),
          content: officeReviewUserText(),
          metadata: {
            source: OFFICE_REVIEW_SOURCE,
            custom: { source: OFFICE_REVIEW_SOURCE },
          },
        });
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

  private async bumpOfficeReviewTools(result: {
    status: string;
    continuation?: boolean;
  }): Promise<void> {
    if (result.status !== "completed") return;
    if (this.reviewBusy) return;
    const session = await this.ensureOfficeSession();
    const tools = countPiToolCallsSinceLastUser(await this.officeBound(session));
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
    await this.appendOfficeUserAndRun({
      id: crypto.randomUUID(),
      content: formatRoutinePrompt(body.name, body.prompt),
      metadata: { source: "routine", custom: { source: "routine" } },
    });
  }

  async listRoutines(): Promise<Routine[]> {
    const live = await this.liveRoutineSchedules();
    const parked = await this.parkedRoutines();
    const rows: Routine[] = live.map((row) =>
      toRoutineDto(
        this.botKey(),
        storedRoutine(row.id, row.payload, true),
        isoUnixSeconds(row.time),
      ),
    );
    for (const [id, payload] of Object.entries(parked)) {
      if (live.some((row) => row.id === id)) continue;
      rows.push(
        toRoutineDto(this.botKey(), storedRoutine(id, payload, false), null),
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
    const payload = routinePayloadFromCreate({
      ...input,
      timezone: await this.resolveOfficeTimezone(input.timezone),
    });
    if (await this.routinesSuspended()) {
      const id = newId();
      await this.putParkedRoutine(id, { ...payload, fireOnUnarchive: true });
      return toRoutineDto(
        this.botKey(),
        storedRoutine(id, payload, true),
        null,
      );
    }
    const row = await this.armRoutine(payload);
    return toRoutineDto(
      this.botKey(),
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
        this.botKey(),
        storedRoutine(id, live.payload, false),
        null,
      );
    }
    const parked = (await this.parkedRoutines())[id];
    if (!parked) throw new RoutineNotFoundError();
    return toRoutineDto(this.botKey(), storedRoutine(id, parked, false), null);
  }

  async resumeRoutine(id: string): Promise<Routine> {
    const parked = (await this.parkedRoutines())[id];
    if (!parked) {
      const live = await this.liveRoutineById(id);
      if (live) {
        return toRoutineDto(
          this.botKey(),
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
      this.botKey(),
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

  private async resolveOfficeTimezone(explicit?: string): Promise<string> {
    const trimmed = explicit?.trim();
    if (trimmed) {
      await this.ctx.storage.put(OFFICE_TIMEZONE_STORAGE, trimmed);
      return trimmed;
    }
    const stored = await this.ctx.storage.get<string>(OFFICE_TIMEZONE_STORAGE);
    if (typeof stored === "string" && stored.trim()) return stored.trim();
    return DEFAULT_ROUTINE_TIMEZONE;
  }

  private async routinesSuspended(): Promise<boolean> {
    return (await this.ctx.storage.get<boolean>("routinesSuspended")) === true;
  }

  private executeConnectors() {
    const connectors: Array<
      | HistoryConnector
      | KnowledgeConnector
      | WorkspaceMcpConnector
      | RoutinesConnector
    > = [
      new HistoryConnector(this.ctx, this.env, () => this),
      new RoutinesConnector(this.ctx, this.env, () => this),
    ];
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
        id: mcpServerId(serverId),
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
      await this.removeMcpServer(mcpServerId(serverId));
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
    const catalog = mcpCatalogStatusFromLive(
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
        await this.stopOffice();
        return;
      }
    } catch (error) {
      console.error("bot actor", job.botId, job.name, error);
    }
  }
}
