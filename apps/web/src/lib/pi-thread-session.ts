/**
 * Office/room Cap’n Web session — lives outside React.
 * UI subscribes; hire/navigate reuse the same handle. Same idea as Relay’s
 * store or Linear’s sync engine: the tree is a view, not the connection.
 */
import {
  applyPiOfficeEvent,
  emptyPiOfficeView,
  isOfficeChatStatus,
  type PiBoundMessage,
  type PiOfficeView,
  parsePiClientEvent,
  parsePiOfficeSnapshot,
  userBoundFromText,
} from "@groxbot/core/browser";
import { newWebSocketRpcSession, RpcTarget } from "capnweb";
import { appendOfficeDebugLine } from "./office-debug";
import { OFFICE_KEEPALIVE_LIMIT } from "./office-keepalive";

export type PiHost = {
  snapshot?(): Promise<unknown>;
  subscribe(subscriber: PiThreadSubscriber): Promise<void>;
  send(input: {
    content: string;
    id?: string;
    metadata?: unknown;
    targetBotId?: string;
  }): Promise<void>;
  stop(): Promise<void>;
  focus?(appId: string): Promise<void>;
  pendingApprovals?(): Promise<unknown>;
  approveApproval?(executionId: string): Promise<unknown>;
  rejectApproval?(executionId: string, seq: number): Promise<unknown>;
  pendingAsks?(): Promise<unknown>;
  answerAsk?(toolCallId: string, answers: unknown): Promise<unknown>;
  skipAsk?(toolCallId: string): Promise<unknown>;
  [Symbol.dispose]?: () => void;
};

type SubscriberHooks = {
  onGeneration: (generation: number) => void;
  onEvent: (event: unknown) => void;
  onStatus: (status: string) => void;
  onError: (message: string) => void;
};

export class PiThreadSubscriber extends RpcTarget {
  constructor(private readonly hooks: SubscriberHooks) {
    super();
  }

  streamGeneration(generation: number) {
    this.hooks.onGeneration(generation);
  }

  event(ev: unknown) {
    this.hooks.onEvent(ev);
  }

  status(status: string) {
    this.hooks.onStatus(status);
  }

  error(message: string) {
    this.hooks.onError(message);
  }
}

export type PiThreadSnapshot = {
  view: PiOfficeView;
  error: Error | undefined;
  connectionError: Error | undefined;
  connected: boolean;
};

export type PiThreadConnect = (
  rpcUrl: string,
  subscriber: PiThreadSubscriber,
) => Promise<PiHost>;

const REACH = "Could not reach this teammate. Try sending again.";

function defaultConnect(rpcUrl: string, subscriber: PiThreadSubscriber) {
  const host = newWebSocketRpcSession<PiHost>(rpcUrl);
  return host.subscribe(subscriber).then(() => host as PiHost);
}

export class PiThreadSession {
  readonly threadId: string;
  rpcUrl: string;
  targetBotId = "";
  private view: PiOfficeView;
  private error: Error | undefined;
  private connectionError: Error | undefined;
  private connected = false;
  private host: PiHost | null = null;
  private connectLoop = 0;
  private connecting = false;
  private disposed = false;
  private listeners = new Set<() => void>();
  private readyWaiters: Array<() => void> = [];
  private snapshot: PiThreadSnapshot;
  private readonly connectFn: PiThreadConnect;
  touchedAt = Date.now();

  constructor(input: {
    threadId: string;
    rpcUrl: string;
    seed?: PiBoundMessage[];
    connect?: PiThreadConnect;
  }) {
    this.threadId = input.threadId;
    this.rpcUrl = input.rpcUrl;
    this.connectFn = input.connect ?? defaultConnect;
    this.view = {
      ...emptyPiOfficeView(input.threadId),
      messages: input.seed ?? [],
    };
    this.snapshot = this.buildSnapshot();
  }

  subscribe = (onStoreChange: () => void): (() => void) => {
    this.listeners.add(onStoreChange);
    return () => {
      this.listeners.delete(onStoreChange);
    };
  };

  get listenerCount(): number {
    return this.listeners.size;
  }

  getSnapshot = (): PiThreadSnapshot => this.snapshot;

  setTarget(targetBotId?: string): void {
    this.targetBotId = targetBotId?.trim() ?? "";
  }

  async waitReady(ms = 20_000): Promise<void> {
    if (this.connected) return;
    await new Promise<void>((resolve, reject) => {
      if (this.connected) {
        resolve();
        return;
      }
      const timer = setTimeout(() => reject(new Error(REACH)), ms);
      this.readyWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async send(input: {
    content: string;
    id?: string;
    metadata?: unknown;
  }): Promise<void> {
    await this.waitReady();
    const host = this.host;
    if (!host) throw new Error(REACH);
    const id = input.id?.trim() || crypto.randomUUID();
    await host.send({
      content: input.content,
      id,
      metadata: input.metadata,
      ...(this.targetBotId ? { targetBotId: this.targetBotId } : {}),
    });
  }

  async onNew(input: {
    content: string;
    metadata?: unknown;
  }): Promise<void> {
    const id = crypto.randomUUID();
    const optimistic = userBoundFromText({
      id,
      content: input.content,
      metadata: input.metadata,
    });
    this.patchView((current) => ({
      ...current,
      messages: current.messages.some((row) => row.id === id)
        ? current.messages
        : [...current.messages, optimistic],
      status: current.status === "streaming" ? "streaming" : "submitted",
    }));
    try {
      await this.send({
        content: input.content,
        id,
        metadata: input.metadata,
      });
    } catch (caught) {
      this.patchView((current) => ({
        ...current,
        messages: current.messages.filter((row) => row.id !== id),
      }));
      throw caught;
    }
  }

  async stop(): Promise<void> {
    await this.host?.stop();
  }

  async focus(appId: string): Promise<void> {
    const next = appId.trim();
    this.patchView((current) =>
      current.focusedAppId === next ? current : { ...current, focusedAppId: next },
    );
    await this.waitReady();
    const host = this.host;
    if (!host?.focus) return;
    await host.focus(next);
  }

  async pendingApprovals(): Promise<unknown> {
    await this.waitReady();
    return this.host?.pendingApprovals?.() ?? [];
  }

  async approveApproval(executionId: string): Promise<unknown> {
    await this.waitReady();
    if (!this.host?.approveApproval) throw new Error(REACH);
    return this.host.approveApproval(executionId);
  }

  async rejectApproval(executionId: string, seq: number): Promise<unknown> {
    await this.waitReady();
    if (!this.host?.rejectApproval) throw new Error(REACH);
    return this.host.rejectApproval(executionId, seq);
  }

  async pendingAsks(): Promise<unknown> {
    await this.waitReady();
    return this.host?.pendingAsks?.() ?? [];
  }

  async answerAsk(toolCallId: string, answers: unknown): Promise<unknown> {
    await this.waitReady();
    if (!this.host?.answerAsk) throw new Error(REACH);
    return this.host.answerAsk(toolCallId, answers);
  }

  async skipAsk(toolCallId: string): Promise<unknown> {
    await this.waitReady();
    if (!this.host?.skipAsk) throw new Error(REACH);
    return this.host.skipAsk(toolCallId);
  }

  async fetchSnapshot(): Promise<PiBoundMessage[] | undefined> {
    const host = this.host;
    if (!host?.snapshot) return undefined;
    return parsePiOfficeSnapshot(await host.snapshot())?.messages;
  }

  /** Idempotent. Hire can call this before the Thread mounts. */
  connect(): void {
    if (this.disposed || this.connected || this.connecting) return;
    this.connecting = true;
    const loop = ++this.connectLoop;
    void this.runConnect(loop);
  }

  dispose(): void {
    this.disposed = true;
    this.connectLoop += 1;
    this.connecting = false;
    this.connected = false;
    this.dropHost();
    this.emit();
  }

  private async runConnect(loop: number): Promise<void> {
    let delayMs = 120;
    for (let attempt = 0; !this.disposed && loop === this.connectLoop; ) {
      try {
        const subscriber = this.makeSubscriber(loop);
        const host = await this.connectFn(this.rpcUrl, subscriber);
        if (this.disposed || loop !== this.connectLoop) {
          try {
            host[Symbol.dispose]?.();
          } catch {
            // replaced
          }
          return;
        }
        this.host = host;
        this.connected = true;
        this.connecting = false;
        this.connectionError = undefined;
        this.emit();
        for (const resolve of this.readyWaiters) resolve();
        this.readyWaiters = [];
        return;
      } catch {
        this.dropHost();
        if (this.disposed || loop !== this.connectLoop) return;
        if (attempt >= 40) {
          this.connecting = false;
          this.connectionError = new Error(REACH);
          this.emit();
          return;
        }
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs = Math.min(Math.round(delayMs * 1.35), 800);
      }
    }
    this.connecting = false;
  }

  private makeSubscriber(loop: number): PiThreadSubscriber {
    const live = () => !this.disposed && loop === this.connectLoop;
    return new PiThreadSubscriber({
      onGeneration: () => {},
      onEvent: (raw) => {
        if (!live()) return;
        const event = parsePiClientEvent(raw);
        if (!event) {
          const snapshot = parsePiOfficeSnapshot(
            raw && typeof raw === "object"
              ? (raw as { snapshot?: unknown }).snapshot
              : null,
          );
          if (!snapshot) return;
          this.patchView((current) =>
            applyPiOfficeEvent(current, {
              threadId: this.threadId,
              seq: current.seq + 1,
              type: "snapshot",
              snapshot,
            }),
          );
          return;
        }
        if (event.type === "debug_log") {
          const line =
            typeof event.line === "string"
              ? event.line
              : typeof event.message === "string"
                ? event.message
                : "";
          if (line) appendOfficeDebugLine(event.threadId || this.threadId, line);
          return;
        }
        this.patchView((current) => applyPiOfficeEvent(current, event));
      },
      onStatus: (next) => {
        if (!live() || !isOfficeChatStatus(next)) return;
        if (next !== "error") this.error = undefined;
        this.patchView((current) => ({
          ...current,
          status: next,
          ...(next !== "error" ? { error: "" } : {}),
        }));
      },
      onError: (message) => {
        if (!live() || !message) return;
        this.error = new Error(message);
        this.patchView((current) => ({
          ...current,
          error: message,
          status: "error",
        }));
      },
    });
  }

  private patchView(fn: (current: PiOfficeView) => PiOfficeView): void {
    this.view = fn(this.view);
    this.emit();
  }

  private dropHost(): void {
    try {
      this.host?.[Symbol.dispose]?.();
    } catch {
      // already closed
    }
    this.host = null;
    this.connected = false;
  }

  private buildSnapshot(): PiThreadSnapshot {
    return {
      view: this.view,
      error: this.error,
      connectionError: this.connectionError,
      connected: this.connected,
    };
  }

  private emit(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }
}

const sessions = new Map<string, PiThreadSession>();

export function peekPiThread(threadId: string): PiThreadSession | undefined {
  return sessions.get(threadId.trim());
}

export function ensurePiThread(input: {
  threadId: string;
  rpcUrl: string;
  seed?: PiBoundMessage[];
  targetBotId?: string;
  connect?: PiThreadConnect;
}): PiThreadSession {
  const threadId = input.threadId.trim();
  const existing = sessions.get(threadId);
  if (existing) {
    existing.touchedAt = Date.now();
    existing.rpcUrl = input.rpcUrl;
    existing.setTarget(input.targetBotId);
    existing.connect();
    return existing;
  }
  evictIdleSessions();
  const session = new PiThreadSession(input);
  session.setTarget(input.targetBotId);
  sessions.set(threadId, session);
  session.connect();
  return session;
}

export function forgetPiThread(threadId: string): void {
  const id = threadId.trim();
  const session = sessions.get(id);
  if (!session) return;
  sessions.delete(id);
  session.dispose();
}

function evictIdleSessions(): void {
  if (sessions.size < OFFICE_KEEPALIVE_LIMIT) return;
  const ranked = [...sessions.entries()].sort(
    (a, b) => a[1].touchedAt - b[1].touchedAt,
  );
  for (const [id, row] of ranked) {
    if (sessions.size < OFFICE_KEEPALIVE_LIMIT) break;
    if (row.listenerCount > 0) continue;
    sessions.delete(id);
    row.dispose();
  }
}

/** Tests. */
export function resetPiThreads(): void {
  for (const session of sessions.values()) session.dispose();
  sessions.clear();
}
