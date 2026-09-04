export interface AdapterContext {
  operationId: string;
  workspaceId: string;
  userId: string;
  botId?: string;
  runId?: string;
  signal: AbortSignal;
}

export interface WakeupJob {
  /** Person product id. The Worker addresses that bot’s own RoomActor, never the group room. */
  botId: string;
  name: string;
  payload: Record<string, unknown>;
  runAt?: Date;
  /** Named schedule on that actor. Replaces the previous one. */
  jobKey?: string;
}

/** Named delayed jobs on a bot actor. */
export interface WakeupDriver {
  enqueue(job: WakeupJob): Promise<void>;
  start(
    handlers?: Record<
      string,
      (payload: Record<string, unknown>) => Promise<void>
    >,
  ): Promise<void>;
  stop(): Promise<void>;
}

/** Send a job to that bot’s own RoomActor. The Worker implements this with a Durable Object stub. */
export type EnqueueJob = (job: WakeupJob) => Promise<void>;

/** Stamp a live app on AppRuntime. The Worker implements this with a Durable Object stub. */
export type InitApp = (
  appId: string,
  templateId: string,
  opts: { workspaceId: string; title: string },
) => Promise<void>;

/** Stamp a RoomActor. `botId` present ⇒ that person’s own room (Pi + computer). Otherwise a group: log only, no Pi. */
export type InitRoom = (
  roomId: string,
  opts: {
    workspaceId: string;
    name: string;
    botId?: string;
    members: Array<{ id: string; name: string; homeRoomId?: string }>;
  },
) => Promise<void>;

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
  | { type: "error"; text: string }
  | {
      type: "usage";
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };

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
