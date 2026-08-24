import type { SandboxKind } from "@groxbot/contracts";

export interface AdapterContext {
  operationId: string;
  workspaceId: string;
  userId: string;
  botId?: string;
  runId?: string;
  signal: AbortSignal;
}

export interface WakeupJob {
  /** Actor key — the bot, never the room. */
  botId: string;
  name: string;
  payload: Record<string, unknown>;
  runAt?: Date;
  /** Named schedule on that actor. Replaces the previous one. */
  jobKey?: string;
}

/** Send a job to the bot actor. The Worker implements this with a Durable Object stub. */
export type EnqueueJob = (job: WakeupJob) => Promise<void>;

/** Stamp a live app on AppRuntime. The Worker implements this with a Durable Object stub. */
export type InitApp = (
  appId: string,
  templateId: string,
  opts: { workspaceId: string; title: string },
) => Promise<void>;

export interface ComputerRef {
  id: string;
  botId: string;
  kind: SandboxKind;
  providerRef?: string;
}

export interface CommandRequest {
  argv: string[];
  cwd?: string;
}

export type ProcessEvent =
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "exit"; code: number };

export interface PokeTeammate {
  id: string;
  name: string;
  title: string;
}

export interface AgentRunRequest {
  botId: string;
  threadId: string;
  runId: string;
  prompt: string;
  instructions: string;
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  model?: string;
  providerEnv?: Record<string, string>;
  /** Other office bots this turn may poke. Omitted for guests (not JSON-safe). */
  teammates?: PokeTeammate[];
  /** Host callback. Dropped on the wire to guest runtimes. */
  pokeTeammate?: (input: { name: string; message: string }) => Promise<string>;
  /** Composio entity for this workspace. */
  composioUserId?: string;
  /** Connected toolkit slugs for this turn. */
  pluginToolkits?: string[];
  /** Host callbacks. Dropped on the wire to guest runtimes. */
  composioSearch?: (query: string) => Promise<string>;
  composioExecute?: (
    slug: string,
    args: Record<string, unknown>,
  ) => Promise<string>;
}

export function composioUserId(workspaceId: string): string {
  return `groxbot:ws:${workspaceId}`;
}

export type AgentRuntimeEvent =
  | { type: "text"; text: string }
  | { type: "progress"; text: string }
  | { type: "done"; text?: string }
  | { type: "error"; text: string };

export type GuestAgentKind = "hermes" | "openclaw" | "generic";

export type HostToGuest =
  | { type: "welcome"; botId: string; name: string }
  | { type: "run"; request: AgentRunRequest }
  | { type: "abort"; runId: string }
  | { type: "idle" }
  | { type: "bye"; reason: string };

export type GuestToHost =
  | { type: "hello"; token: string; kind: GuestAgentKind }
  | { type: "event"; runId: string; event: AgentRuntimeEvent }
  | { type: "bye" };

export interface PortableFile {
  path: string;
  content: string;
}
