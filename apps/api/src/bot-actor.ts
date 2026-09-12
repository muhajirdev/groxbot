/** Cloudflare-only. Excluded from `tsc`. Disk is Computer; office chat is Pi over Cap'n Web. */
import { createAITools } from "@cloudflare/computer/tools";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { WorkersAiBinding } from "@groxbot/adapters/edge";
import {
  appendOfficeAssistantText,
  appendOfficeUserText,
  compactOfficeSession,
  DurableSessionStorage,
  migrateOfficeChatToSession,
  persistOfficeSessionEvent,
  piBoundFromSessionEntries,
  resolveOfficePiModel,
  resolvePiStreamFn,
  runPiTurn,
  Session,
  sqliteSessionStore,
} from "@groxbot/adapters/edge";
import {
  HOSTED_STARTER_MODEL,
  labelForModel,
  type OpenAiCodexAuth,
  officeUserFromHeaders,
  type Routine,
  reasoningFromEffort,
  stampIncomingOfficeUser,
  type TemplateId,
  type ThinkingEffort,
  WORKSPACE_PLAN_REQUIRED_MESSAGE,
} from "@groxbot/contracts";
import {
  applyOfficeReviewTurn,
  applyOfficeSkillsToSystem,
  assertWorkspacePlanAllowed,
  awayOfficeExcerpt,
  buildOfficeSystemPrompt,
  ComputerFileError,
  ComputerPathError,
  ComputerWriteError,
  type ConnectedPluginAccount,
  CURSOR_POLL_CALLBACK,
  CURSOR_POLL_MAX_ATTEMPTS,
  CursorCloudError,
  composeSoul,
  computerWorkerShell,
  countPiToolCallsSinceLastUser,
  createCursorCloudAgent,
  createSkillImportHttp,
  cursorParkedCopy,
  cursorPollDelayMs,
  cursorProofCopy,
  DEFAULT_ROUTINE_TIMEZONE,
  decodeComputerBytes,
  diskFromComputerFs,
  downloadComputerFile,
  emptyOfficeReviewCounters,
  encryptionSecret,
  ensureComputerHome,
  formatRoutinePrompt,
  getCursorCloudRun,
  isContextOverflowError,
  isCursorRunTerminal,
  isoUnixSeconds,
  isThoughtSignatureError,
  jsonClone,
  lastOfficeHumanUserId,
  lastOfficeTaskTrigger,
  lastOfficeUserIsIntro,
  lastPiAssistantText,
  listComputerEntries,
  listConnectedPluginAccounts,
  loadOfficeSkillCatalog,
  mcpCatalogForExecute,
  newId,
  OFFICE_AWAY_CALLBACK,
  OFFICE_AWAY_SETTLE_MS,
  OFFICE_AWAY_STORAGE,
  OFFICE_GENERATION_STORAGE,
  OFFICE_INTRO_STORAGE,
  OFFICE_REVIEW_STORAGE,
  OFFICE_WORKSPACE_HEADER,
  type OfficeChatMessage,
  OfficeHireError,
  type OfficeHistorySearch,
  officeCanReadSkills,
  officeHiredBotProjection,
  officeIntroTurnTools,
  officeMarketplaceHits,
  officeModelContextWindow,
  officeReviewAnnounce,
  officeReviewDue,
  officeReviewNoteMetadata,
  officeReviewUserText,
  officeRoomUrl,
  type PiBoundMessage,
  type PiClientEvent,
  type PiOfficeSnapshot,
  type PiSendMessageInput,
  PiSteerQueue,
  parseCursorDispatchPayload,
  parseCursorLaunchInput,
  parseOfficeAwayPayload,
  parseOfficeAwayStored,
  parseOfficeChatMessages,
  parseOfficeReviewCounters,
  parseTinyfishKeys,
  parseVisibility,
  patchComputerWorkspace,
  persistOpenAiCodexAuth,
  piAssistantTurnSettled,
  piLogShouldRun,
  piQueuedUserBound,
  prepareRoutineCreate,
  RoutineError,
  RoutineNotFoundError,
  RoutineScheduleError,
  readComputerFile,
  recordAppChatCard,
  recordComputerUsage,
  requireCursorApiKey,
  resolveOfficeHire,
  resolveRunModel,
  type StoredRoutine,
  searchOfficeHistory,
  shouldArmAwayOfficePing,
  shouldEnqueueOfficeReview,
  shouldSendAwayOfficePing,
  soulOverlayFromWrite,
  TinyfishKeyPool,
  TOOL_TRUNCATE_MAX_BYTES,
  TOOL_TRUNCATE_MAX_LINES,
  takePiAssistantDraft,
  teammatePrompt,
  tinyfishPoolStart,
  toRoutineDto,
  withComputerOfficeTools,
  withOfficeExecuteDescription,
  writeInboxFile,
} from "@groxbot/core";
import { bots, mcpConnections, member, organization, user } from "@groxbot/db";
import { createD1Db } from "@groxbot/db/d1";
import { ORPCError } from "@orpc/server";
import { Agent } from "agents";
import { AgentContextProvider } from "agents/experimental/memory/session";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { DurableObjectAppStore } from "./app-runtime-do.js";
import { createRoomAppTool } from "./bot-app.js";
import { OfficeApprovalBoard } from "./bot-approval.js";
import { createAskTool, OfficeAskBoard } from "./bot-ask.js";
import { BotsConnector } from "./bot-bots-connector.js";
import { createBrowserAgentTools } from "./bot-browser.js";
import { createBotComputer } from "./bot-computer-workspace.js";
import { CursorConnector } from "./bot-cursor-connector.js";
import {
  createBundlingExecutor,
  createOfficeExecuteRuntime,
  createOfficeExecuteTool,
} from "./bot-execute.js";
import { HistoryConnector } from "./bot-history.js";
import { KnowledgeConnector } from "./bot-knowledge.js";
import {
  bindToMarkdown,
  createPageAgentTools,
  runToMarkdownTool,
} from "./bot-markdown.js";
import { WorkspaceMcpConnector } from "./bot-mcp-connector.js";
import {
  type OfficeChatSubscriber,
  officeRpcResponse,
} from "./bot-office-rpc.js";
import {
  aiToolsToPi,
  officeAgentTool,
  wrapAgentToolsForComputerUsage,
} from "./bot-office-tools.js";
import { PluginsConnector } from "./bot-plugins.js";
import { createPresentTool } from "./bot-present.js";
import { RoutinesConnector } from "./bot-routines-connector.js";
import { createSkillTool } from "./bot-skill.js";
import { SkillsStoreConnector } from "./bot-skills-store.js";
import { createStampAppTool } from "./bot-stamp.js";
import { createBot } from "./bots.js";
import {
  agentRuntimeSource,
  productEnv,
  type RuntimeSource,
  requireCatalogDb,
  withCodexProxy,
} from "./env.js";
import { knowledgeAccess } from "./knowledge.js";
import { r2KnowledgeDisk } from "./knowledge-r2.js";
import type { SendEmailBinding } from "./mail.js";
import { sendAwayOfficeMail } from "./mail.js";
import { httpMcpConnectionLike } from "./mcp-http.js";
import { initRoomActor } from "./room-rpc.js";
export interface WorkerEnv {
  DB: D1Database;
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
  POLAR_ACCESS_TOKEN?: string;
  POLAR_WEBHOOK_SECRET?: string;
  POLAR_ENVIRONMENT?: string;
  GROX_GATEWAY_URL?: string;
  GROX_GATEWAY_SECRET?: string;
  GROXBOT_CODEX_PROXY_URL?: string;
  GROXBOT_CODEX_PROXY_SECRET?: string;
  EMAIL?: SendEmailBinding;
  AI?: WorkersAiBinding;
  APP_RUNTIME: DurableObjectNamespace;
  ROOM_ACTOR: DurableObjectNamespace;
  LOADER: unknown;
  BROWSER: {
    quickAction(
      action: "pdf" | "screenshot",
      body: { html?: string; url?: string },
    ): Promise<Response>;
  };
  KNOWLEDGE?: R2Bucket;
  PRODUCT_CACHE?: KVNamespace;
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
  private turnEffort: ThinkingEffort = "off";
  private turnEnv: RuntimeSource = {};
  private botLoaded = false;
  private botLoading: Promise<void> | null = null;
  protected officeId = "";
  /** Live app this room is looking at. Same storage on home and group. */
  protected focusedAppId = "";
  /** Product bot id. DO instance name is the home room id. */
  protected personId = "";
  private ownerUserId = "";
  private botVisibility: "private" | "shared" = "shared";
  /** Claimed a due review; other waitUntil callbacks should not start another. */
  private reviewQueued = false;
  /** Office review turn in flight. */
  private reviewBusy = false;
  private soulOverlay = new AgentContextProvider(this, "soul-evolved");
  private memoryBlock = new AgentContextProvider(this, "memory");

  /** Seed a marketplace package onto this home room (soul + memory + skip intro). */
  protected async applyHirePackage(input: {
    soul?: string;
    memory?: string;
    skipIntro?: boolean;
  }): Promise<void> {
    const soul = input.soul?.trim() ?? "";
    const memory = input.memory?.trim() ?? "";
    if (soul) {
      await this.ensureBotLoaded();
      await this.soulOverlay.set(soulOverlayFromWrite(this.soulPrompt, soul));
    }
    if (memory) {
      await this.memoryBlock.set(memory);
    }
    if (input.skipIntro || soul) {
      await this.ctx.storage.put(OFFICE_INTRO_STORAGE, true);
    }
  }
  private officeSubscribers = new Set<OfficeChatSubscriber>();
  /** Human steered this in-flight turn from the composer. */
  private officeTurnTouched = false;
  private officeStatus: "ready" | "submitted" | "streaming" | "error" = "ready";
  private officeError = "";
  private officeTurn: AbortController | null = null;
  private officeQueue: Promise<void> = Promise.resolve();
  private officeSteer = new PiSteerQueue();
  private officeAsk = new OfficeAskBoard();
  private officeApproval = new OfficeApprovalBoard();
  private officeSession: Session | null = null;
  private officeSeq = 0;
  private tinyfishKeys: TinyfishKeyPool | null = null;
  private workspaceMcp: Array<{
    id: string;
    name: string;
    url: string;
  }> = [];
  private workspacePlugins: ConnectedPluginAccount[] = [];

  async onStart(): Promise<void> {
    const stored = await this.ctx.storage.get<string>("officeId");
    if (typeof stored === "string" && stored && !this.officeId) {
      this.officeId = stored;
    }
    this.sql`DROP TABLE IF EXISTS groxbot_routines`;
    this.ensureOfficeChatTable();
    await this.ensureOfficeSession();
    await this.loadAppFocus();
    await this.healComputerFiles();
    console.log(`[bot ${this.name}] onStart`);
  }

  /** Legacy flat log — must exist before any `ensureOfficeSession` (init can beat onStart). */
  private ensureOfficeChatTable(): void {
    this.sql`CREATE TABLE IF NOT EXISTS office_chat (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      payload TEXT NOT NULL
    )`;
  }

  private catalogMcpBot() {
    return this.personId
      ? { visibility: this.botVisibility, userId: this.ownerUserId }
      : { visibility: "shared" as const, userId: "" };
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
      onPaused: (executionId, signal) =>
        this.officeApproval.wait(executionId, signal),
    });
    const mcp = this.workspaceMcp.map((row) => row.name);
    const plugins = [
      ...new Set(this.workspacePlugins.map((row) => row.toolkit)),
    ];
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
            read: {
              maxLines: TOOL_TRUNCATE_MAX_LINES,
              maxBytes: TOOL_TRUNCATE_MAX_BYTES,
            },
          }),
        ),
        {
          spill: async (path, content) => {
            await this.computer.fs.mkdir("/workspace/.tool-output", {
              recursive: true,
            });
            await this.computer.fs.writeFile(
              path,
              new TextEncoder().encode(content),
            );
          },
          readDocument: async ({ path, offset }) =>
            runToMarkdownTool(page, { path, offset }),
        },
      ),
      ...createPageAgentTools(page),
      ...(this.env.BROWSER
        ? createBrowserAgentTools({
            browser: this.env.BROWSER,
            workspace: this.workspace,
          })
        : []),
      createPresentTool(),
      createAskTool(this.officeAsk),
      ...this.stampAppTools(),
      this.setContextTool(),
      ...this.roomAppTools(),
      ...(skill ? [skill] : []),
      {
        ...execute,
        description: withOfficeExecuteDescription(
          typeof execute.description === "string" ? execute.description : "",
          Boolean(this.env.KNOWLEDGE),
          {
            history: true,
            routines: true,
            bots: true,
            cursor: true,
            mcp,
            plugins: plugins.length > 0,
          },
        ),
      },
    ];
  }

  private async officeAgentTools(): Promise<AgentTool[]> {
    await this.ensureWorkspaceMcp();
    await this.ensureWorkspacePlugins();
    return this.getAgentTools();
  }

  private async officeExecuteRuntime() {
    await this.ensureWorkspaceMcp();
    await this.ensureWorkspacePlugins();
    return createOfficeExecuteRuntime({
      ctx: this.ctx,
      executor: createBundlingExecutor(this.env.LOADER, { timeout: 120_000 }),
      page: {
        workspace: this.workspace,
        convert: bindToMarkdown(this.env.AI),
        tinyfishKeys: this.pageTinyfishPool(),
      },
      connectors: this.executeConnectors(),
    });
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
      await this.ensureBotLoaded();
      const claimed = request.headers.get(OFFICE_WORKSPACE_HEADER);
      if (!this.officeId || claimed !== this.officeId) {
        return new Response("Forbidden", { status: 403 });
      }
      if (this.personId && this.botVisibility === "private") {
        const user = officeUserFromHeaders(request.headers);
        if (user && this.ownerUserId && user.userId !== this.ownerUserId) {
          return new Response("Forbidden", { status: 403 });
        }
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
    if (request.method === "POST" && url.pathname === "/routines/list") {
      return this.handleRoutinesList();
    }
    if (request.method === "POST" && url.pathname === "/routines/create") {
      return this.handleRoutinesCreate(request);
    }
    if (request.method === "POST" && url.pathname === "/routines/update") {
      return this.handleRoutinesUpdate(request);
    }
    if (request.method === "POST" && url.pathname === "/routines/pause") {
      return this.handleRoutinesSetActive(request, false);
    }
    if (request.method === "POST" && url.pathname === "/routines/resume") {
      return this.handleRoutinesSetActive(request, true);
    }
    if (request.method === "POST" && url.pathname === "/routines/run") {
      return this.handleRoutinesRun(request);
    }
    if (request.method === "POST" && url.pathname === "/routines/remove") {
      return this.handleRoutinesRemove(request);
    }
    if (request.method === "POST" && url.pathname === "/routines/suspend") {
      return this.handleRoutinesSuspend(request);
    }
    if (request.method === "POST" && url.pathname === "/reload-brain") {
      return this.handleReloadBrain(request);
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
    this.ctx.waitUntil(this.markOfficeHumanPresent());
    const generation =
      (await this.ctx.storage.get<number>(OFFICE_GENERATION_STORAGE)) ?? 0;
    await live.streamGeneration(generation);
    // No hidden hire turn — empty desk until the human writes.
    await this.ctx.storage.put(OFFICE_INTRO_STORAGE, true);
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
    if (this.focusedAppId) snapshot.focusedAppId = this.focusedAppId;
    else snapshot.focusedAppId = "";
    return snapshot;
  }

  async setAppFocus(appId: string): Promise<void> {
    const next = appId.trim();
    if (next === this.focusedAppId) return;
    this.focusedAppId = next;
    if (next) await this.ctx.storage.put("focusedAppId", next);
    else await this.ctx.storage.delete("focusedAppId");
    await this.broadcastAppFocus(next);
  }

  protected async loadAppFocus(): Promise<void> {
    const stored = await this.ctx.storage.get<string>("focusedAppId");
    this.focusedAppId = typeof stored === "string" ? stored.trim() : "";
  }

  protected async broadcastAppFocus(appId: string): Promise<void> {
    await this.broadcastOfficeEvent({ type: "focus", appId });
  }

  protected roomAppTools() {
    if (!this.focusedAppId || !this.env.APP_RUNTIME) return [];
    return [
      createRoomAppTool({
        focusedAppId: () => this.focusedAppId,
        workspaceId: () => this.officeId,
        runtime: this.env.APP_RUNTIME,
      }),
    ];
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
    const running = Boolean(this.officeTurn && !this.officeTurn.signal.aborted);
    this.ctx.waitUntil(this.markOfficeHumanPresent());
    if (running) this.officeTurnTouched = true;
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

  /** Code Mode persists paused runs; expose them to the office UI. */
  async officePendingApprovals(): Promise<unknown> {
    return (await this.officeExecuteRuntime()).pending();
  }

  async officeApproveApproval(executionId: string): Promise<unknown> {
    const id = executionId.trim();
    if (!id) throw new Error("Missing approval execution id.");
    const result = await (await this.officeExecuteRuntime()).approve({
      executionId: id,
    });
    this.officeApproval.resume(id, result);
    return result;
  }

  async officeRejectApproval(
    executionId: string,
    seq: number,
  ): Promise<unknown> {
    const id = executionId.trim();
    if (!id || !Number.isSafeInteger(seq)) throw new Error("Invalid approval.");
    const rejected = await (await this.officeExecuteRuntime()).reject({
      executionId: id,
      seq,
    });
    this.officeApproval.reject(id);
    return { rejected };
  }

  async officePendingAsks(): Promise<unknown> {
    return this.officeAsk.pending();
  }

  async officeAnswerAsk(
    toolCallId: string,
    answers: unknown,
  ): Promise<unknown> {
    const id = toolCallId.trim();
    if (!id) throw new Error("Missing question.");
    const result = this.officeAsk.answer(id, answers);
    if (!result) throw new Error("That question is no longer waiting.");
    return result;
  }

  async officeSkipAsk(toolCallId: string): Promise<unknown> {
    const id = toolCallId.trim();
    if (!id) throw new Error("Missing question.");
    const result = this.officeAsk.skip(id);
    if (!result) throw new Error("That question is no longer waiting.");
    return result;
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

  protected stampAppTools(listingBotId?: string): AgentTool[] {
    if (!this.env.APP_RUNTIME) return [];
    return [
      createStampAppTool({
        workspaceId: () => this.officeId,
        initApp: (id, templateId, opts) =>
          new DurableObjectAppStore(this.env.APP_RUNTIME).init(
            id,
            templateId,
            opts,
          ),
        recordCard: (app) => this.recordOfficeAppCard(app, listingBotId),
      }),
    ];
  }

  protected async recordOfficeAppCard(
    app: {
      id: string;
      templateId: TemplateId;
      title: string;
    },
    listingBotId?: string,
  ): Promise<void> {
    await this.ensureOfficeId();
    const botId = (listingBotId ?? this.personId).trim();
    if (!this.officeId || !botId) return;
    const env = productEnv(this.env);
    const { db, close } = createD1Db(requireCatalogDb(this.env));
    try {
      await recordAppChatCard(db, {
        workspaceId: this.officeId,
        botId,
        app,
      });
    } finally {
      await close();
    }
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
    const turnStartedAt = Date.now();
    let firstModelEvent = false;
    await this.bumpOfficeGeneration();
    await this.broadcastOfficeStatus();
    await this.emitOfficeDebug(turnStartedAt, "turn_start");
    await this.ensureBotLoaded();
    await this.emitOfficeDebug(turnStartedAt, "bot_loaded", this.turnModel);
    if (abort.signal.aborted) return;
    await this.healComputerFiles();
    await this.emitOfficeDebug(turnStartedAt, "computer_ready");
    const session = await this.ensureOfficeSession();
    let streamFn = this.turnStreamFn();
    if (!streamFn) {
      // Early subscribe may have missed the roster row; reload once.
      await this.ensureBotLoaded({ refresh: true });
      streamFn = this.turnStreamFn();
    }
    if (!streamFn) {
      this.officeStatus = "error";
      this.officeError =
        "Add a model key, or use Groxbot’s included gateway, to talk to teammates.";
      await this.emitOfficeDebug(turnStartedAt, "error", "no_stream");
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
    const startedAt = turnStartedAt;
    const visible = !intro;
    this.officeTurnTouched = false;
    let computerSeconds = 0;
    if (this.officeId) {
      const env = productEnv(this.env);
      const source = agentRuntimeSource(env);
      const { db, close } = createD1Db(requireCatalogDb(this.env));
      try {
        await assertWorkspacePlanAllowed(db, this.officeId, source);
      } catch (error) {
        this.officeStatus = "error";
        this.officeError =
          error instanceof Error
            ? error.message
            : WORKSPACE_PLAN_REQUIRED_MESSAGE;
        await this.emitOfficeDebug(turnStartedAt, "error", "plan_blocked");
        await this.broadcastOfficeError();
        await this.broadcastOfficeStatus();
        return;
      } finally {
        await close();
      }
    }
    await this.emitOfficeDebug(turnStartedAt, "plan_ok");
    const baseTools = intro
      ? officeIntroTurnTools(await this.officeAgentTools())
      : await this.officeAgentTools();
    await this.emitOfficeDebug(
      turnStartedAt,
      "tools_ready",
      `${baseTools.length} tools`,
    );
    const tools = wrapAgentToolsForComputerUsage(baseTools, (seconds) => {
      computerSeconds += seconds;
      this.officeTurnTouched = true;
    });
    const system = await this.officeSystemPrompt(bound, tools);
    await this.emitOfficeDebug(
      turnStartedAt,
      "prompt_ready",
      `${system.length} chars`,
    );
    try {
      if (!intro) this.officeAsk.enterLive();
      let stripThoughtReplay = false;
      const runTurn = async () => {
        const context = await session.buildContext();
        return runPiTurn({
          systemPrompt: system,
          messages: context.messages,
          model,
          streamFn,
          tools,
          signal: abort.signal,
          stripThoughtReplay,
          getSteeringMessages: () =>
            intro ? [] : this.officeSteer.drainMessages(),
          getFollowUpMessages: () =>
            intro ? [] : this.officeSteer.drainMessages(),
          reasoning: reasoningFromEffort(this.turnEffort),
          onEvent: async (event) => {
            if (!firstModelEvent) {
              firstModelEvent = true;
              await this.emitOfficeDebug(
                turnStartedAt,
                "first_model_event",
                event.type,
              );
            }
            if (event.type === "tool_execution_start") {
              const name =
                "toolName" in event && typeof event.toolName === "string"
                  ? event.toolName
                  : "tool";
              await this.emitOfficeDebug(turnStartedAt, "tool_start", name);
            }
            if (event.type === "tool_execution_end") {
              const name =
                "toolName" in event && typeof event.toolName === "string"
                  ? event.toolName
                  : "tool";
              await this.emitOfficeDebug(
                turnStartedAt,
                "tool_end",
                `${name}${event.isError ? " error" : ""}`,
              );
            }
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
                ...(queued ? { id: queued.id, metadata: queued.metadata } : {}),
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
      };
      await this.compactOfficeContext(session, {
        model,
        streamFn,
        signal: abort.signal,
      });
      await this.emitOfficeDebug(turnStartedAt, "compact_done");
      let result = await runTurn();
      if (
        result.stopReason === "error" &&
        isContextOverflowError(result.errorMessage)
      ) {
        await this.emitOfficeDebug(turnStartedAt, "compact_retry");
        const compacted = await this.compactOfficeContext(session, {
          model,
          streamFn,
          signal: abort.signal,
          force: true,
        });
        if (compacted) result = await runTurn();
      }
      if (
        result.stopReason === "error" &&
        isThoughtSignatureError(result.errorMessage)
      ) {
        await this.emitOfficeDebug(turnStartedAt, "thought_signature_retry");
        stripThoughtReplay = true;
        result = await runTurn();
      }
      if (result.stopReason === "aborted" || abort.signal.aborted) {
        await this.emitOfficeDebug(turnStartedAt, "turn_aborted");
        this.officeStatus = "ready";
        await this.broadcastOfficeStatus();
        return;
      }
      if (result.stopReason === "error") {
        this.officeStatus = "error";
        this.officeError = result.errorMessage || "The model run failed.";
        console.warn("office turn error", {
          room: this.name,
          workspace: this.officeId ? "yes" : "no",
          model: this.turnModel,
          error: this.officeError.slice(0, 180),
        });
        await this.emitOfficeDebug(
          turnStartedAt,
          "turn_error",
          this.officeError.slice(0, 120),
        );
        await this.broadcastOfficeError();
        await this.broadcastOfficeStatus();
        return;
      }
      await this.emitOfficeDebug(
        turnStartedAt,
        "turn_done",
        result.stopReason || "ok",
      );
      this.officeStatus = "ready";
      await this.broadcastOfficeStatus();
      const after = await this.officeBound(session);
      if (computerSeconds > 0 && this.officeId && this.personId) {
        const userId = lastOfficeHumanUserId(after) || this.ownerUserId || "";
        if (userId) {
          this.ctx.waitUntil(
            this.persistComputerUsage({
              workspaceId: this.officeId,
              userId,
              botId: this.personId,
              seconds: computerSeconds,
            }),
          );
        }
      }
      this.ctx.waitUntil(
        this.maybeArmAwayOfficePing({
          visible,
          startedAt,
          touched: this.officeTurnTouched,
          seq: this.officeSeq,
          excerpt: awayOfficeExcerpt(lastPiAssistantText(after)),
          toUserId: lastOfficeHumanUserId(after),
        }),
      );
      this.enqueueOfficeReview({
        status: "completed",
        continuation: false,
      });
    } catch (error) {
      if (abort.signal.aborted) {
        await this.emitOfficeDebug(turnStartedAt, "turn_aborted");
        this.officeStatus = "ready";
        await this.broadcastOfficeStatus();
        return;
      }
      this.officeStatus = "error";
      this.officeError =
        error instanceof Error ? error.message : "The model run failed.";
      await this.emitOfficeDebug(
        turnStartedAt,
        "turn_error",
        this.officeError.slice(0, 120),
      );
      await this.broadcastOfficeError();
      await this.broadcastOfficeStatus();
    } finally {
      this.officeAsk.leaveLive();
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
    const tools = (await this.officeAgentTools()).map((tool) => ({
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
    const tool = (await this.officeAgentTools()).find(
      (row) => row.name === name,
    );
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
      buildOfficeSystemPrompt({
        identity,
        tools,
        mcp: this.workspaceMcp.map((row) => row.name),
        plugins: [...new Set(this.workspacePlugins.map((row) => row.toolkit))],
      }),
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
    this.ensureOfficeChatTable();
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
    this.ensureOfficeChatTable();
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

  /** Cap’n Web + console turn timing (Settings → Debug). */
  private async emitOfficeDebug(
    startedAt: number,
    phase: string,
    detail?: string,
  ): Promise<void> {
    const ms = Math.max(0, Date.now() - startedAt);
    const line = detail ? `${phase} +${ms}ms ${detail}` : `${phase} +${ms}ms`;
    console.log("office turn", this.name, line);
    await this.broadcastOfficeEvent({
      type: "debug_log",
      phase,
      ms,
      line,
    });
  }

  private broadcastOfficeStatus(): Promise<void> {
    return this.broadcastOffice((sub) => sub.status(this.officeStatus));
  }

  private broadcastOfficeError(): Promise<void> {
    return this.broadcastOffice((sub) => sub.error(this.officeError));
  }

  private async markOfficeHumanPresent(): Promise<void> {
    await this.cancelAwayOfficePing();
  }

  private async cancelAwayOfficePing(): Promise<void> {
    const stored = parseOfficeAwayStored(
      await this.ctx.storage.get(OFFICE_AWAY_STORAGE),
    );
    if (stored?.scheduleId) {
      try {
        await this.cancelSchedule(stored.scheduleId);
      } catch {
        // Already fired or missing.
      }
    }
    await this.ctx.storage.delete(OFFICE_AWAY_STORAGE);
  }

  private async maybeArmAwayOfficePing(input: {
    visible: boolean;
    startedAt: number;
    touched: boolean;
    seq: number;
    excerpt: string;
    toUserId: string | null;
  }): Promise<void> {
    const stored = parseOfficeAwayStored(
      await this.ctx.storage.get(OFFICE_AWAY_STORAGE),
    );
    const toUserId = input.toUserId?.trim() ?? "";
    if (!toUserId) return;
    if (
      !shouldArmAwayOfficePing({
        visible: input.visible,
        startedAt: input.startedAt,
        now: Date.now(),
        subscriberCount: this.officeSubscribers.size,
        touched: input.touched,
        seq: input.seq,
        pingedSeq: stored?.pingedSeq,
      })
    ) {
      return;
    }
    if (stored?.scheduleId) {
      try {
        await this.cancelSchedule(stored.scheduleId);
      } catch {
        // Already fired or missing.
      }
    }
    const row = await this.schedule(
      new Date(Date.now() + OFFICE_AWAY_SETTLE_MS),
      OFFICE_AWAY_CALLBACK,
      {
        seq: input.seq,
        excerpt: input.excerpt || undefined,
        toUserId,
      },
    );
    await this.ctx.storage.put(OFFICE_AWAY_STORAGE, {
      seq: input.seq,
      scheduleId: row.id,
      pingedSeq: stored?.pingedSeq,
    });
  }

  /**
   * Agents `this.schedule` callback. One ping after a long office turn
   * if the Cap’n Web is still empty.
   */
  async runAwayOfficePing(payload: unknown): Promise<void> {
    const body = parseOfficeAwayPayload(payload);
    if (!body) return;
    const stored = parseOfficeAwayStored(
      await this.ctx.storage.get(OFFICE_AWAY_STORAGE),
    );
    if (
      !shouldSendAwayOfficePing({
        subscriberCount: this.officeSubscribers.size,
        seq: body.seq,
        stored,
      })
    ) {
      return;
    }
    try {
      await this.sendAwayOfficePing(body.toUserId, body.excerpt);
      await this.ctx.storage.put(OFFICE_AWAY_STORAGE, {
        seq: body.seq,
        pingedSeq: body.seq,
      });
    } catch (error) {
      console.error("bot actor away office ping", this.name, error);
    }
  }

  private async sendAwayOfficePing(
    toUserId: string | undefined,
    excerpt?: string,
  ): Promise<void> {
    await this.ensureBotLoaded();
    const env = productEnv(this.env);
    const recipientId = toUserId?.trim() ?? "";
    if (!this.personId || !this.officeId || !recipientId) return;
    const { db } = createD1Db(requireCatalogDb(this.env));
    const [bot] = await db
      .select({
        name: bots.name,
        workspaceId: bots.workspaceId,
      })
      .from(bots)
      .where(eq(bots.id, this.personId))
      .limit(1);
    if (!bot) return;
    const [org] = await db
      .select({ slug: organization.slug })
      .from(organization)
      .where(eq(organization.id, bot.workspaceId))
      .limit(1);
    const [recipient] = await db
      .select({ email: user.email })
      .from(user)
      .innerJoin(member, eq(member.userId, user.id))
      .where(
        and(
          eq(user.id, recipientId),
          eq(member.organizationId, bot.workspaceId),
        ),
      )
      .limit(1);
    const url = officeRoomUrl(env.webOrigin, org?.slug ?? "", this.name);
    const to = recipient?.email?.trim() ?? "";
    if (!url || !to) return;
    await sendAwayOfficeMail(
      { ...env, email: this.env.EMAIL },
      {
        to,
        botName: bot.name || this.hireName,
        url,
        excerpt,
      },
    );
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

  /**
   * Load roster/soul/model from D1 into this DO.
   * Pass `refresh` after Settings → Model so the next turn uses the new id
   * without waiting for a cold start.
   */
  protected async ensureBotLoaded(opts?: { refresh?: boolean }): Promise<void> {
    if (opts?.refresh) {
      if (this.botLoading) await this.botLoading;
      this.botLoaded = false;
    }
    if (this.botLoaded) return;
    if (!this.botLoading) {
      const t0 = Date.now();
      console.log(`[bot ${this.name}] loadBot begin`);
      this.botLoading = this.loadBot()
        .then(() => {
          // Hire can wake this DO before D1 has the bot row. Do not
          // freeze an empty brain — retry on the next ensureBotLoaded.
          if (this.personId) {
            this.botLoaded = true;
            console.log(
              `[bot ${this.name}] loadBot done +${Date.now() - t0}ms`,
            );
          } else {
            console.log(
              `[bot ${this.name}] loadBot miss +${Date.now() - t0}ms (not created yet)`,
            );
          }
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

  /**
   * Settings saved a new model (or name). Refresh turnModel / soul; optionally
   * force-compact so Gemini/Claude do not reject prior tool turns.
   */
  async reloadOfficeBrain(opts?: { compact?: boolean }): Promise<void> {
    await this.ensureBotLoaded({ refresh: true });
    if (!opts?.compact) return;
    const streamFn = this.turnStreamFn();
    if (!streamFn) return;
    const session = await this.ensureOfficeSession();
    await this.compactOfficeContext(session, {
      model: this.turnPiModel(),
      streamFn,
      force: true,
    });
  }

  private async handleReloadBrain(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as {
      compact?: unknown;
    };
    await this.reloadOfficeBrain({
      compact: body.compact === true,
    });
    return Response.json({
      ok: true,
      model: this.turnModel,
    });
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
    return resolvePiStreamFn(
      withCodexProxy(productEnv(this.env), this.turnEnv),
      {
        ai: this.env.AI,
        gatewayId: this.turnEnv.CLOUDFLARE_AI_GATEWAY_ID,
        modelId: this.turnModel,
        metadata: {
          workspaceId: this.officeId,
          botId: this.botKey(),
          roomId: this.name,
        },
        persistCodexAuth: (auth) => this.persistCodexAuth(auth),
      },
    );
  }

  private turnPiModel() {
    return resolveOfficePiModel(this.turnEnv, this.turnModel);
  }

  private async persistCodexAuth(auth: OpenAiCodexAuth): Promise<void> {
    const userId = this.ownerUserId?.trim();
    const workspaceId = this.officeId?.trim();
    if (!userId || !workspaceId) return;
    const env = productEnv(this.env);
    const source = agentRuntimeSource(env);
    const { db } = createD1Db(requireCatalogDb(this.env));
    await persistOpenAiCodexAuth(
      db,
      { userId, workspaceId },
      auth,
      encryptionSecret(source, env.production),
    );
  }

  private async compactOfficeContext(
    session: Session,
    opts: {
      model: ReturnType<RoomHome["turnPiModel"]>;
      streamFn: NonNullable<ReturnType<RoomHome["turnStreamFn"]>>;
      signal?: AbortSignal;
      force?: boolean;
    },
  ): Promise<boolean> {
    try {
      return await compactOfficeSession(session, {
        model: opts.model,
        streamFn: opts.streamFn,
        signal: opts.signal,
        contextWindow: officeModelContextWindow(opts.model),
        force: opts.force,
      });
    } catch (error) {
      console.error("bot actor compact", this.name, error);
      return false;
    }
  }

  private async loadBot(): Promise<void> {
    const env = productEnv(this.env);
    const source = agentRuntimeSource(env);
    const { db } = createD1Db(requireCatalogDb(this.env));
    const [bot] = await db
      .select()
      .from(bots)
      .where(or(eq(bots.homeRoomId, this.name), eq(bots.id, this.name)))
      .limit(1);
    if (!bot) return;
    this.personId = bot.id;
    this.officeId = bot.workspaceId;
    this.ownerUserId = bot.userId;
    this.botVisibility = parseVisibility(bot.visibility);
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
    this.turnEffort = overlay.effort;
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

  private async persistComputerUsage(input: {
    workspaceId: string;
    userId: string;
    botId: string;
    seconds: number;
  }): Promise<void> {
    const { db, close } = createD1Db(requireCatalogDb(this.env));
    try {
      await recordComputerUsage(db, input);
    } catch (error) {
      console.error(
        `[bot ${this.name}] computer usage +${input.seconds}s`,
        error,
      );
    } finally {
      await close();
    }
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

  protected async handleDestroy(): Promise<Response> {
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

  private officeKnowledge() {
    if (!this.env.KNOWLEDGE || !this.officeId) return null;
    return r2KnowledgeDisk(this.env.KNOWLEDGE);
  }

  /**
   * After enough tool work, file on an idle snapshot turn. The kick stays off
   * the office log; a real write shows one Learned line in the thread.
   */
  private enqueueOfficeReview(result: {
    status: string;
    continuation?: boolean;
  }): void {
    this.ctx.waitUntil(this.maybeRunOfficeReview(result));
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
        idle: this.officeSteer.pending().length === 0,
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
        !this.officeKnowledge() ||
        this.officeSteer.pending().length > 0
      ) {
        return;
      }
      await this.enqueueTurn(() => this.runOfficeReviewTurn(counters));
    } finally {
      this.reviewQueued = false;
    }
  }

  /** Snapshot Pi turn. Tools write for real; only a filed line joins the log. */
  private async runOfficeReviewTurn(
    counters: ReturnType<typeof parseOfficeReviewCounters>,
  ): Promise<void> {
    if (this.reviewBusy || this.officeSteer.pending().length > 0) return;
    this.reviewBusy = true;
    const abort = new AbortController();
    this.officeTurn = abort;
    try {
      await this.ctx.storage.put(
        OFFICE_REVIEW_STORAGE,
        emptyOfficeReviewCounters(),
      );
      await this.ensureBotLoaded();
      if (abort.signal.aborted) {
        await this.ctx.storage.put(OFFICE_REVIEW_STORAGE, counters);
        return;
      }
      const streamFn = this.turnStreamFn();
      if (!streamFn) {
        await this.ctx.storage.put(OFFICE_REVIEW_STORAGE, counters);
        return;
      }
      const session = await this.ensureOfficeSession();
      const tools = await this.officeAgentTools();
      const bound = await this.officeBound(session);
      const system = await this.officeSystemPrompt(bound, tools);
      const model = this.turnPiModel();
      await this.compactOfficeContext(session, {
        model,
        streamFn,
        signal: abort.signal,
      });
      const context = await session.buildContext();
      const result = await runPiTurn({
        systemPrompt: system,
        messages: [
          ...context.messages,
          {
            role: "user",
            content: officeReviewUserText(),
            timestamp: Date.now(),
          },
        ],
        model,
        streamFn,
        tools,
        signal: abort.signal,
        reasoning: reasoningFromEffort(this.turnEffort),
      });
      if (result.stopReason === "aborted" || abort.signal.aborted) {
        await this.ctx.storage.put(OFFICE_REVIEW_STORAGE, counters);
        return;
      }
      const note = officeReviewAnnounce(result.text);
      if (!note) return;
      const id = crypto.randomUUID();
      const metadata = officeReviewNoteMetadata();
      await appendOfficeAssistantText(session, {
        id,
        content: note,
        metadata,
      });
      await this.broadcastOfficeEvent({
        type: "message_end",
        id,
        message: {
          role: "assistant",
          content: [{ type: "text", text: note }],
          timestamp: Date.now(),
          stopReason: "stop",
        },
        metadata,
      });
    } catch (error) {
      await this.ctx.storage.put(OFFICE_REVIEW_STORAGE, counters);
      console.error("bot actor office review", this.name, error);
    } finally {
      if (this.officeTurn === abort) this.officeTurn = null;
      this.reviewBusy = false;
      const leftover = this.officeSteer.takeAll();
      if (leftover.length) {
        const session = await this.ensureOfficeSession();
        for (const row of leftover) {
          await appendOfficeUserText(session, row);
        }
        if (!abort.signal.aborted) {
          this.ctx.waitUntil(this.enqueueOfficeTurn());
        }
      }
    }
  }

  private async bumpOfficeReviewTools(result: {
    status: string;
    continuation?: boolean;
  }): Promise<void> {
    if (result.status !== "completed") return;
    if (this.reviewBusy) return;
    const session = await this.ensureOfficeSession();
    const tools = countPiToolCallsSinceLastUser(
      await this.officeBound(session),
    );
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

  /**
   * Agents `this.schedule` callback. Cursor Cloud Agents run for minutes —
   * poll until a PR (or failure) can land in this room.
   */
  async pollCursorCloudAgent(payload: unknown): Promise<void> {
    const body = parseCursorDispatchPayload(payload);
    if (!body) return;
    try {
      await this.ensureBotLoaded();
      const apiKey = requireCursorApiKey(this.turnEnv);
      const run = await getCursorCloudRun({
        apiKey,
        agentId: body.agentId,
        runId: body.runId,
      });
      if (!isCursorRunTerminal(run.status)) {
        if (body.attempt + 1 >= CURSOR_POLL_MAX_ATTEMPTS) {
          await this.postOfficeAssistantNote(
            cursorProofCopy({
              repo: body.repo,
              status: "EXPIRED",
            }),
          );
          return;
        }
        await this.schedule(
          new Date(Date.now() + cursorPollDelayMs(body.attempt + 1)),
          CURSOR_POLL_CALLBACK,
          { ...body, attempt: body.attempt + 1 },
        );
        return;
      }
      await this.postOfficeAssistantNote(
        cursorProofCopy({ repo: body.repo, ...run }),
        {
          source: "cursor",
          custom: {
            source: "cursor",
            agentId: body.agentId,
            prUrl: run.prUrl,
          },
        },
      );
    } catch (error) {
      const message =
        error instanceof CursorCloudError
          ? error.message
          : "Cursor could not be reached. Trying again.";
      const retry =
        body.attempt + 1 < 3 && !(error instanceof CursorCloudError);
      if (retry) {
        await this.schedule(
          new Date(Date.now() + cursorPollDelayMs(body.attempt + 1)),
          CURSOR_POLL_CALLBACK,
          { ...body, attempt: body.attempt + 1 },
        );
        return;
      }
      await this.postOfficeAssistantNote(message);
    }
  }

  private async postOfficeAssistantNote(
    content: string,
    metadata?: unknown,
  ): Promise<void> {
    const text = content.trim();
    if (!text) return;
    const session = await this.ensureOfficeSession();
    const id = crypto.randomUUID();
    await appendOfficeAssistantText(session, { id, content: text, metadata });
    await this.broadcastOfficeEvent({
      type: "message_end",
      id,
      message: {
        role: "assistant",
        content: [{ type: "text", text }],
        timestamp: Date.now(),
        stopReason: "stop",
      },
      metadata,
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

  async listTeammates(): Promise<
    Array<{ id: string; name: string; title: string; homeRoomId: string }>
  > {
    await this.ensureBotLoaded();
    const workspaceId = this.officeId?.trim();
    const userId = this.ownerUserId?.trim();
    if (!workspaceId || !userId) return [];
    const env = productEnv(this.env);
    const { db } = createD1Db(requireCatalogDb(this.env));
    const rows = await db
      .select({
        id: bots.id,
        name: bots.name,
        title: bots.title,
        homeRoomId: bots.homeRoomId,
      })
      .from(bots)
      .where(
        and(
          eq(bots.workspaceId, workspaceId),
          isNull(bots.archivedAt),
          or(eq(bots.visibility, "shared"), eq(bots.userId, userId)),
        ),
      );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      title: row.title,
      homeRoomId: row.homeRoomId ?? "",
    }));
  }

  searchMarketplace(input: {
    query?: string;
    category?: string;
    limit?: number;
  }) {
    return officeMarketplaceHits(input);
  }

  async launchCursorAgent(input: {
    repo?: string;
    prompt?: string;
    ref?: string;
  }) {
    await this.ensureBotLoaded();
    try {
      const parsed = parseCursorLaunchInput(input);
      const apiKey = requireCursorApiKey(this.turnEnv);
      const launched = await createCursorCloudAgent({
        apiKey,
        repo: parsed.repo,
        prompt: parsed.prompt,
        ref: parsed.ref,
      });
      await this.schedule(
        new Date(Date.now() + cursorPollDelayMs(0)),
        CURSOR_POLL_CALLBACK,
        {
          agentId: launched.agentId,
          runId: launched.runId,
          repo: launched.repo,
          prompt: parsed.prompt,
          attempt: 0,
        },
      );
      const parked = cursorParkedCopy(launched.repo);
      await this.postOfficeAssistantNote(parked, {
        source: "cursor",
        custom: { source: "cursor", agentId: launched.agentId },
      });
      return {
        status: "parked",
        agentId: launched.agentId,
        runId: launched.runId,
        repo: launched.repo,
        message: parked,
      };
    } catch (error) {
      const message =
        error instanceof CursorCloudError
          ? error.message
          : "Cursor could not start.";
      await this.postOfficeAssistantNote(message);
      throw error instanceof CursorCloudError
        ? error
        : new CursorCloudError(message);
    }
  }

  async hireTeammate(input: {
    name?: string;
    title?: string;
    description?: string;
    instructions?: string;
    marketplaceId?: string;
  }) {
    await this.ensureBotLoaded();
    const workspaceId = this.officeId?.trim();
    const userId = this.ownerUserId?.trim();
    if (!workspaceId || !userId) {
      throw new OfficeHireError("This office has no owner.");
    }
    const resolved = resolveOfficeHire(input);
    const env = productEnv(this.env);
    const { db } = createD1Db(requireCatalogDb(this.env));
    const disk = this.officeKnowledge();
    try {
      const bot = await createBot(
        {
          db,
          initRoom: (roomId, opts) =>
            initRoomActor(this.env.ROOM_ACTOR, roomId, opts),
          knowledge: disk
            ? knowledgeAccess(
                disk,
                createSkillImportHttp(),
                bindToMarkdown(this.env.AI),
              )
            : undefined,
        },
        { userId, workspaceId },
        resolved,
      );
      return officeHiredBotProjection(bot);
    } catch (error) {
      if (error instanceof OfficeHireError) throw error;
      if (error instanceof ORPCError) {
        throw new OfficeHireError(error.message);
      }
      throw error;
    }
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

  async updateRoutine(
    id: string,
    input: {
      name: string;
      prompt: string;
      cron: string;
      timezone?: string;
    },
  ): Promise<Routine> {
    const live = await this.liveRoutineById(id);
    const parked = (await this.parkedRoutines())[id];
    if (!live && !parked) throw new RoutineNotFoundError();
    const payload = routinePayloadFromCreate({
      ...input,
      timezone: await this.resolveOfficeTimezone(
        input.timezone ?? live?.payload.timezone ?? parked?.timezone,
      ),
    });
    payload.createdAt =
      live?.payload.createdAt ?? parked?.createdAt ?? payload.createdAt;
    if (live) {
      const previous = live.payload;
      await this.cancelSchedule(id);
      try {
        const row = await this.armRoutine(payload);
        return toRoutineDto(
          this.botKey(),
          storedRoutine(row.id, payload, true),
          isoUnixSeconds(row.time),
        );
      } catch (error) {
        try {
          await this.armRoutine(previous);
        } catch {
          /* keep the original error */
        }
        throw error;
      }
    }
    if (!parked) throw new RoutineNotFoundError();
    await this.putParkedRoutine(id, {
      ...payload,
      fireOnUnarchive: parked.fireOnUnarchive,
    });
    return toRoutineDto(this.botKey(), storedRoutine(id, payload, false), null);
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

  async runRoutine(id: string): Promise<void> {
    if (await this.routinesSuspended()) {
      throw new RoutineError("This teammate is archived.");
    }
    const live = await this.liveRoutineById(id);
    const parked = (await this.parkedRoutines())[id];
    const payload = live?.payload ?? parked ?? null;
    if (!payload) throw new RoutineNotFoundError();
    await this.appendOfficeUserAndRun({
      id: crypto.randomUUID(),
      content: formatRoutinePrompt(payload.name, payload.prompt),
      metadata: { source: "routine", custom: { source: "routine" } },
    });
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

  private async handleRoutinesUpdate(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      name?: unknown;
      prompt?: unknown;
      cron?: unknown;
      timezone?: unknown;
    };
    const id = typeof body.id === "string" ? body.id : "";
    try {
      return Response.json(
        await this.updateRoutine(id, {
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

  private async handleRoutinesRun(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    try {
      await this.runRoutine(id);
      return Response.json({ ok: true });
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
      | SkillsStoreConnector
      | WorkspaceMcpConnector
      | RoutinesConnector
      | BotsConnector
      | CursorConnector
      | PluginsConnector
    > = [
      new HistoryConnector(this.ctx, this.env, () => this),
      new RoutinesConnector(this.ctx, this.env, () => this),
      new BotsConnector(this.ctx, this.env, () => this),
      new CursorConnector(this.ctx, this.env, () => this),
    ];
    if (this.env.KNOWLEDGE) {
      const disk = r2KnowledgeDisk(this.env.KNOWLEDGE);
      connectors.push(
        new KnowledgeConnector(this.ctx, this.env, disk, () => this.officeId, {
          convert: bindToMarkdown(this.env.AI),
          readComputer: (path) => this.workspace.readFileBytes(path),
          trigger: async () => {
            const session = await this.ensureOfficeSession();
            return lastOfficeTaskTrigger(await this.officeBound(session));
          },
        }),
        new SkillsStoreConnector(this.ctx, this.env, disk, () => this.officeId),
      );
    }
    connectors.push(...this.mcpExecuteConnectors());
    connectors.push(...this.pluginExecuteConnectors());
    return connectors;
  }

  private async ensureWorkspaceMcp(): Promise<void> {
    await this.ensureBotLoaded();
    if (!this.officeId) {
      this.workspaceMcp = [];
      return;
    }
    const env = productEnv(this.env);
    const { db } = createD1Db(requireCatalogDb(this.env));
    const rows = await db
      .select()
      .from(mcpConnections)
      .where(eq(mcpConnections.workspaceId, this.officeId));
    const catalog = mcpCatalogForExecute(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        url: row.url,
        status: row.status,
        hostBotId: row.hostBotId,
        visibility: row.visibility,
        userId: row.userId,
        hasOauth: Boolean(row.oauthCiphertext),
      })),
      this.catalogMcpBot(),
    );
    this.workspaceMcp = catalog.map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
    }));
  }

  private async ensureWorkspacePlugins(): Promise<void> {
    await this.ensureBotLoaded();
    if (!this.officeId || !this.env.COMPOSIO_API_KEY?.trim()) {
      this.workspacePlugins = [];
      return;
    }
    const env = productEnv(this.env);
    const { db } = createD1Db(requireCatalogDb(this.env));
    this.workspacePlugins = await listConnectedPluginAccounts(
      db,
      this.officeId,
      this.catalogMcpBot(),
    );
  }

  private pluginExecuteConnectors(): PluginsConnector[] {
    const apiKey = this.env.COMPOSIO_API_KEY?.trim();
    if (!this.officeId || !apiKey || this.workspacePlugins.length === 0) {
      return [];
    }
    const workspaceId = this.officeId;
    const accounts = this.workspacePlugins;
    return [
      new PluginsConnector(this.ctx, this.env, () => ({
        workspaceId,
        accounts,
        apiKey,
      })),
    ];
  }

  private mcpExecuteConnectors(): WorkspaceMcpConnector[] {
    if (!this.officeId) return [];
    const env = productEnv(this.env);
    const callbackHost = (env.apiUrl ?? env.webOrigin).replace(/\/$/, "");
    return this.workspaceMcp.flatMap((row) => {
      if (!row.url) return [];
      return [
        new WorkspaceMcpConnector(
          this.ctx,
          this.env,
          httpMcpConnectionLike({
            env,
            db: createD1Db(requireCatalogDb(this.env)).db,
            workspaceId: this.officeId,
            id: row.id,
            name: row.name,
            url: row.url,
            callbackHost,
          }),
          row.name,
        ),
      ];
    });
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
