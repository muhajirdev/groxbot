import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { init } from "@flue/runtime";
import { type Flue, sqlite, start } from "@flue/runtime/node";
import type {
  AdapterContext,
  AgentRunRequest,
  AgentRuntime,
  AgentRuntimeEvent,
} from "@groxbot/adapter-kit";
import { FLUE_ECHO_RUNTIME } from "../runtime-core.js";
import { installCloudflareGatewayProvider } from "./cloudflare-provider.js";
import { setTeammateTurn, teammateInstanceId } from "./context.js";
import { createEchoProvider, ECHO_MODEL } from "./echo.js";
import { flueErrorText } from "./errors.js";
import { installWorkspaceProviderAuth } from "./overlay-auth.js";
import { Teammate } from "./teammate.js";

export interface FlueRuntimeOptions {
  echo?: boolean;
  env?: NodeJS.ProcessEnv;
}

function envValue(source: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = source[key]?.trim();
  return value || undefined;
}

export function resolveFlueModel(
  echo: boolean,
  source: NodeJS.ProcessEnv = process.env,
): string {
  if (echo) return ECHO_MODEL;
  const explicit = envValue(source, "GROXBOT_MODEL");
  if (explicit) return explicit;
  throw new Error(
    `Flue needs a model from Settings → Models. Tests construct ScriptedAgentRuntime; the echo harness uses ${FLUE_ECHO_RUNTIME}.`,
  );
}

export function flueConfigured(
  source: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(envValue(source, "GROXBOT_MODEL"));
}

function persistence(source: NodeJS.ProcessEnv) {
  const file = envValue(source, "FLUE_DB_PATH");
  const dataDir = envValue(source, "DATA_DIR");
  const path =
    file ?? (dataDir ? `${dataDir.replace(/\/$/, "")}/flue.sqlite` : undefined);
  if (!path) return undefined;
  mkdirSync(dirname(path), { recursive: true });
  return sqlite(path);
}

/**
 * Pi harness via Flue `start()` in this Node process.
 * One Teammate type; instances are `botId:threadId`.
 */
export class FlueAgentRuntime implements AgentRuntime {
  private readonly echo: boolean;
  private readonly env: NodeJS.ProcessEnv;
  private model: string | undefined;
  private boot: Promise<Flue> | undefined;
  private flue: Flue | undefined;
  private readonly running = new Map<
    string,
    { abort: AbortController; instanceId: string }
  >();

  constructor(options: FlueRuntimeOptions = {}) {
    this.echo = options.echo === true;
    this.env = options.env ?? {};
  }

  /** Mutate the overlay Flue/Pi already closed over. Do not replace the object. */
  applyEnv(env: NodeJS.ProcessEnv): void {
    for (const key of Object.keys(this.env)) delete this.env[key];
    Object.assign(this.env, env);
    this.model = undefined;
  }

  private resolvedModel(): string {
    this.model ??= resolveFlueModel(this.echo, this.env);
    return this.model;
  }

  async abort(runId: string): Promise<void> {
    const current = this.running.get(runId);
    current?.abort.abort();
    if (!current || !this.boot) return;
    await this.ensureStarted();
    await init(Teammate, { id: current.instanceId }).abort();
  }

  async stop(): Promise<void> {
    if (!this.boot) return;
    const flue = this.flue ?? (await this.boot);
    await flue.stop();
    this.flue = undefined;
    this.boot = undefined;
  }

  async *run(
    request: AgentRunRequest,
    context: AdapterContext,
  ): AsyncIterable<AgentRuntimeEvent> {
    const instanceId = teammateInstanceId(request.botId, request.threadId);
    const controller = new AbortController();
    this.running.set(request.runId, { abort: controller, instanceId });
    const signal = mergeSignals(context.signal, controller.signal);
    yield { type: "progress", text: "working…" };
    try {
      const model = request.model?.trim() || this.resolvedModel();
      await this.ensureStarted();
      const poke = request.pokeTeammate;
      setTeammateTurn(instanceId, {
        instructions: request.instructions,
        model,
        teammates: request.teammates,
        poke: poke ? (name, message) => poke({ name, message }) : undefined,
        pluginToolkits: request.pluginToolkits,
        composioSearch: request.composioSearch,
        composioExecute: request.composioExecute,
      });
      const handle = init(Teammate, { id: instanceId });
      const receipt = await handle.dispatch({
        message: { kind: "user", body: request.prompt },
      });
      const reply = await handle.read(receipt, { signal });
      if (signal.aborted) {
        yield { type: "done", text: reply.text || "stopped" };
        return;
      }
      const text = reply.text.trim();
      if (!text) throw new Error("Flue returned an empty reply");
      yield { type: "text", text };
      yield { type: "done", text };
    } catch (error) {
      if (isAbortError(error) || signal.aborted) {
        yield { type: "done", text: "stopped" };
        return;
      }
      yield { type: "error", text: flueErrorText(error) };
    } finally {
      this.running.delete(request.runId);
    }
  }

  private ensureStarted(): Promise<Flue> {
    this.boot ??= this.start();
    return this.boot;
  }

  private async start(): Promise<Flue> {
    const echo = this.echo ? createEchoProvider() : undefined;
    const flue = await start({
      agents: [Teammate],
      db: persistence(this.env),
      env: this.env,
      providers: echo ? [echo.provider] : undefined,
    });
    if (!echo) {
      installWorkspaceProviderAuth(this.env);
      installCloudflareGatewayProvider(this.env);
    }
    this.flue = flue;
    return flue;
  }
}

/** Flue allows one `start()` per process. Echo and live are separate slots;
 * the worker uses one. Env overlays mutate the existing object. */
let liveRuntime: FlueAgentRuntime | undefined;
let echoRuntime: FlueAgentRuntime | undefined;

export function flueRuntimePoolSize(): number {
  return (liveRuntime ? 1 : 0) + (echoRuntime ? 1 : 0);
}

export function getFlueAgentRuntime(
  echo: boolean,
  env: NodeJS.ProcessEnv = process.env,
): FlueAgentRuntime {
  if (echo) {
    echoRuntime ??= new FlueAgentRuntime({ echo: true, env: {} });
    echoRuntime.applyEnv(env);
    return echoRuntime;
  }
  liveRuntime ??= new FlueAgentRuntime({ echo: false, env: {} });
  liveRuntime.applyEnv(env);
  return liveRuntime;
}

export async function stopFlueAgentRuntime(): Promise<void> {
  const runtimes = [liveRuntime, echoRuntime].filter(
    (runtime): runtime is FlueAgentRuntime => Boolean(runtime),
  );
  liveRuntime = undefined;
  echoRuntime = undefined;
  await Promise.all(runtimes.map((runtime) => runtime.stop()));
}

function mergeSignals(
  left: AbortSignal | undefined,
  right: AbortSignal,
): AbortSignal {
  if (!left) return right;
  return AbortSignal.any([left, right]);
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError")
  );
}
